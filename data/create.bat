@echo off

if not exist astorb.json (
    echo Unpack astorb.json
    xz -dk astorb.json.lzma
) else (
    echo Already exists: astorb.json
)

if not exist astorb.nsrdb (
    echo Create astorb.nsrdb
    perl ../script/nsr.pl astorb.json
) else (
    echo Already exists: astorb.nsrdb
)
