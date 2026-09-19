#define MyAppVersion "2.4.9"

[Setup]
; Informações da Aplicação
AppName=CSApp Ryuuchen
AppVersion={#MyAppVersion}
AppPublisher=Ryuuchen
DefaultDirName={autopf}\CSApp
DefaultGroupName=CSApp
; Onde o ficheiro .exe final vai ser guardado (Cria a pasta Instalador)
OutputDir=.\Instalador
OutputBaseFilename=CSApp_v{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=icon.ico
; Não precisa de permissões de admin obrigatórias para instalar no perfil do utilizador
PrivilegesRequired=lowest

[Files]
; Copia todos os ficheiros da nossa pasta para a pasta de instalação
; Ignora a pasta do instalador, o git, o script, e os teus dados/logs privados! 
; Agora ignora também os node_modules, código fonte, ficheiros temporários e de contexto porque empacotámos tudo num executável!
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "Instalador\*,setup_script.iss,.git\*,data.json,logs.txt,node_modules\*,server.js,fix*.js,temp.js,package*.json,temp\*,CONTEXTO_PROJETO.md,diff.txt,README.md,public\uploads\*"

[Icons]
; Cria um atalho no Ambiente de Trabalho que vai abrir o nosso ficheiro .bat!
Name: "{autodesktop}\CSApp"; Filename: "{app}\Iniciar-CSApp.bat"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
; Atalho no menu iniciar
Name: "{group}\CSApp"; Filename: "{app}\Iniciar-CSApp.bat"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"

[Run]
; No fim de instalar, pergunta se quer já abrir o painel
Filename: "{app}\Iniciar-CSApp.bat"; Description: "Ligar o CSApp agora"; Flags: nowait postinstall skipifsilent
