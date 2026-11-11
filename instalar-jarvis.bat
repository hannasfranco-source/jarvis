@echo off
title J.A.R.V.I.S. - Instalador Gringa Ads
echo.
echo   Iniciando instalacao do Jarvis...
echo   (nao feche esta janela)
echo.
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/hannasfranco-source/jarvis/main/instalar.ps1 | iex"
pause
