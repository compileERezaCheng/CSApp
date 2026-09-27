#define MyAppVersion "2.4.13"

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
; Apenas ficheiros distribuíveis: nunca incluir data.json, backups, logs ou uploads locais.
Source: "CSApp_Server.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "cloudflared.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "Iniciar-CSApp.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "CSApp-Tray.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion
Source: "plugins\time-badge\*"; DestDir: "{app}\plugins\time-badge"; Flags: ignoreversion

[Dirs]
Name: "{app}\public\uploads"

[Icons]
; Arranca o ícone da bandeja sem abrir uma janela de consola
Name: "{autodesktop}\CSApp"; Filename: "{app}\Iniciar-CSApp.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
; Atalho no menu iniciar
Name: "{group}\CSApp"; Filename: "{app}\Iniciar-CSApp.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"

[Run]
; No fim de instalar, pergunta se quer já abrir o painel
Filename: "{app}\Iniciar-CSApp.vbs"; Description: "Ligar o CSApp agora"; Flags: shellexec nowait postinstall skipifsilent
