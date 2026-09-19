@echo off
title Servidor CSApp (Ryuuchen)
color 0B
echo ===================================================
echo               CSApp - RYUUCHEN
echo ===================================================
echo.
echo O teu Servidor local esta a iniciar...
echo.
echo AVISO: Nao feches esta janela preta! 
echo Podes simplesmente minimiza-la para a barra de tarefas.
echo.
echo O teu painel vai abrir automaticamente no browser.
echo Se nao abrir, vai manualmente a: http://localhost:3000
echo.
echo ===================================================

:: O browser vai ser aberto automaticamente pelo servidor Node!

:: Inicia a app em si
CSApp_Server.exe

:: Se o node crashar por algum motivo, a janela nao fecha sozinha
pause
