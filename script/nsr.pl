use strict;
use warnings;

# use Getopt::Long;
my $input = $ARGV[0];
my $output = $ARGV[1];

# check for input file argument and if it does exist
die "Usage: generate.pl INPUT [OUTPUT]\n" unless defined $input;
die "Input file does not exist: ", $input, "\n" unless -f $input;
$output = $input . ".nsrdb" unless defined $output;
$output =~ s/\.json\.nsrdb$/\.nsrdb/;

use JSON; 
use File::Slurp;
# simple data reading
my $jsdata = read_file($input);
die "error loading json name db" unless $jsdata;
my $json = JSON->new->decode($jsdata);
die "error loading json data" unless $json;

# convert array to hash
if (ref($json) eq "ARRAY") {
    my $count = 0;
    my $object = {};
    foreach (@{$json}) {
        $object->{$_} =
            $count ++;
    }
    $json = $object;
}

# finally we must have a json object
die "json must be an object" if ref($json) ne "HASH";

# create "inline" class
package CharGroup;

sub new
{
    shift @_;
    my $self = {
        _length => 0,
        _offset => 0,
        _char => $_[1],
        _parent => $_[0]
    };
    bless $self;
}

sub calcOffsets
{
    my ($self) = @_;
    my $offset = $self->{_offset};
    # I write out my table plus finalizer
    $offset += $self->tableSize(); 
    # all children are written after it
    foreach my $key (sort keys %{$self}) {
        next if $key =~ m/^_/;
        next unless $self->{$key}->{_length};
        $self->{$key}->{_offset} = $offset;
        $offset = $self->{$key}->calcOffsets();
    } 
    return $offset;
}

sub tableSize
{
    my ($self) = @_;
    my $size = 1; # finalizer
    return 0 if $_[0]->{_length} == 0;
    foreach my $char (sort keys %{$self}) {
        next if $char =~ m/^_/;
        my $child = $self->{$char};
        if ($child->{_length} && $child->{_value}) {
            $size += 1; # additional value
        }
        # at least two
        $size += 2;

    }
    return $size;
}

sub writeData
{
    my ($self, $fh) = @_;
    # should we produce anything?
    if ($self->{_length} > 0) {
        # first write out my own char table
        foreach my $char (sort keys %{$self}) {
            next if $char =~ m/^_/;
            my $child = $self->{$char};
            my $point = ord($child->{_char});
            my $ptr = $child->{_offset}; 
            my $val = $child->{_value}; 
            if ($child->{_length} && defined $val) {
                syswrite($fh, pack("VVV", $point | 0xC0000000, $val, $ptr + 1));
            }
            elsif ($child->{_length}) {
                syswrite($fh, pack("VV", $point | 0x40000000, $ptr + 1));
            }
            elsif (defined $val) {
                syswrite($fh, pack("VV", $point | 0x80000000, $val));
            }
            else {
                die "invalid leaf";
            }
        }
        # emit the table closer
        syswrite($fh, pack("V", 0));
        # then render my children
        foreach my $char (sort keys %{$self}) {
            next if $char =~ m/^_/;
            $self->{$char}->writeData($fh);
        }
    }
}

# skip back to main package
package main;

# low-level
use Fcntl;

# get the words for this index
my @words = sort keys %{$json};

# print debug message to the console
warn "writing ", scalar(@words), " leaf entries\n";

# create the new char group
my $root = CharGroup->new;

# add each word to the index
foreach my $word (@words) {
    # split the word into chars
    my @chars = split(//, $word);
    # the iterator variable
    my $current = $root;
    # loop until we have no more characters
    while (defined(my $char = shift @chars)) {
        # check if branch already exists?
        unless (exists $current->{$char}) {
            # create the new branch
            $current->{$char} =
            CharGroup->new($current, $char);
            # increment the size
            $current->{_length} ++;
        }
        # go deeped into the three
        $current = $current->{$char};
    }
    # assign the value from the json
    $current->{_value} = $json->{$word};
}

# calculate all offsets
$root->calcOffsets();

# create/open file and overwrite and truncate
sysopen(my $fh, $output, O_WRONLY | O_CREAT | O_TRUNC);
die "could not open output: ", $output, "\n" unless $fh;

# report output file
warn "opened ", $output, "\n";

# write the identifier "NSR1"
syswrite($fh, pack("V", 0x3152534E));
# write number of full leaves info
syswrite($fh, pack("V", scalar(@words)));
# write the main root block header
syswrite($fh, pack("V", 0x0000FFFF));

# write out the data
$root->writeData($fh);

# print final message to the console
warn "successfully written\n";
