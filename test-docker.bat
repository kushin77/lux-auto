@echo off
REM Ultra-simple docker test
setlocal
set DOCKER="C:\Program Files\Docker\Docker\resources\bin\docker.exe"
%DOCKER% version | find "Client"
endlocal
