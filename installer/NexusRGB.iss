#define AppVersion "0.1.0"
#define Payload "..\dist\app"
[Setup]
AppId={{BEFFBF04-40A0-4E59-87C0-223B51E92B84}
AppName=Nexus RGB
AppVersion={#AppVersion}
AppPublisher=JonJonGf
AppPublisherURL=https://github.com/JonJonGf/nexus-rgb
AppSupportURL=https://github.com/JonJonGf/nexus-rgb/issues
AppUpdatesURL=https://github.com/JonJonGf/nexus-rgb/releases
AppCopyright=Copyright (c) 2026 JonJonGf
VersionInfoVersion=0.1.0.0
VersionInfoProductName=Nexus RGB
VersionInfoProductVersion=0.1.0.0
DefaultDirName={autopf}\Nexus RGB
DefaultGroupName=Nexus RGB
DisableDirPage=no
UsePreviousAppDir=yes
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=NexusRGB-Setup-{#AppVersion}
SetupIconFile=..\native\app.ico
UninstallDisplayIcon={app}\NexusRGB.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
PrivilegesRequired=admin
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=..\docs\INSTALACAO.txt
; Installation closes only owned tray processes in preflight. An AppMutex here
; would abort at startup before that code can run. Uninstall keeps its guard below.
CloseApplications=yes
RestartApplications=no
UsePreviousTasks=yes
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"; InfoBeforeFile: "..\docs\INSTALLATION.en.txt"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
[CustomMessages]
english.DesktopIcon=Create a desktop shortcut
brazilianportuguese.DesktopIcon=Criar atalho na área de trabalho
english.TrayStartup=Show the Nexus RGB tray icon when signing in to Windows
brazilianportuguese.TrayStartup=Mostrar ícone do Nexus RGB ao entrar no Windows
english.PawnIO=Open the signed PawnIO driver installer (RGB RAM and some motherboards)
brazilianportuguese.PawnIO=Abrir instalador do driver assinado PawnIO (RGB da RAM e algumas placas-mãe)
english.UninstallNexus=Uninstall Nexus RGB
brazilianportuguese.UninstallNexus=Desinstalar Nexus RGB
english.RestartNexus=Restart Nexus and OpenRGB
brazilianportuguese.RestartNexus=Reiniciar Nexus e OpenRGB
english.OpenNexus=Open Nexus RGB
brazilianportuguese.OpenNexus=Abrir Nexus RGB
[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"
Name: "traystartup"; Description: "{cm:TrayStartup}"
Name: "pawnio"; Description: "{cm:PawnIO}"
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\vendor\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "..\vendor\PawnIO_setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "service-preflight.ps1"; Flags: dontcopy
Source: "backup-before-upgrade.ps1"; Flags: dontcopy
Source: "..\scripts\install-path.ps1"; Flags: dontcopy
[Icons]
Name: "{group}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"
Name: "{group}\{cm:UninstallNexus}"; Filename: "{uninstallexe}"
Name: "{group}\{cm:RestartNexus}"; Filename: "{app}\NexusRGB.exe"; Parameters: "--restart-rgb"
Name: "{commondesktop}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Tasks: desktopicon
Name: "{commonstartup}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Parameters: "--tray"; Tasks: traystartup
[Registry]
Root: HKLM; Subkey: "Software\Classes\nexusrgb"; ValueType: string; ValueData: "URL:Nexus RGB"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\nexusrgb"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKLM; Subkey: "Software\Classes\nexusrgb\shell\open\command"; ValueType: string; ValueData: """{app}\NexusRGB.exe"" --restart-rgb ""%1"""
[Run]
Filename: "{app}\NexusRGB.exe"; Description: "{cm:OpenNexus}"; Flags: nowait postinstall skipifsilent runasoriginaluser
Filename: "{app}\NexusRGB.exe"; Parameters: "--tray"; Flags: nowait runasoriginaluser; Check: ShouldLaunchTray
[Code]
function ProcessIdToSessionId(dwProcessId: DWORD; var pSessionId: DWORD): BOOL;
  external 'ProcessIdToSessionId@kernel32.dll stdcall';
function GetCurrentProcessId: DWORD;
  external 'GetCurrentProcessId@kernel32.dll stdcall';

var
  ServiceResumeMask: Integer;
  PreflightReady: Boolean;
  InstallationStarted: Boolean;
  RuntimeNeedsRestart: Boolean;
  SetupFailed: Boolean;
  PortsPage: TInputQueryWizardPage;
  PanelPortValue, SDKPortValue, AlexaPortValue: Integer;
  PreparedRoot: String;

function GetInstallerSessionId: DWORD;
var
  Pid, Sid: DWORD;
begin
  Pid := GetCurrentProcessId;
  Sid := 1;
  if not ProcessIdToSessionId(Pid, Sid) then Sid := 1;
  Result := Sid;
end;

function PowerShellPath: String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;
function LocalText(Portuguese, English: String): String;
begin
  if ActiveLanguage = 'english' then Result := English else Result := Portuguese;
end;
function ShouldLaunchTray: Boolean;
begin
  if GetInstallerSessionId = 0 then begin
    Result := False;
    Exit;
  end;
  Result := FileExists(ExpandConstant('{tmp}\nexus-tray-resume.txt')) or WizardIsTaskSelected('traystartup');
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
  Command: String;
begin
  Result := '';
  if PreflightReady then begin
    if (CompareText(PreparedRoot, WizardDirValue) <> 0) or
       (StrToIntDef(PortsPage.Values[0], 0) <> PanelPortValue) or
       (StrToIntDef(PortsPage.Values[1], 0) <> SDKPortValue) or
       (StrToIntDef(PortsPage.Values[2], 0) <> AlexaPortValue) then
      Result := LocalText('A preparação já foi concluída. Cancele e reabra o instalador para mudar a pasta ou as portas; os serviços serão restaurados.', 'Preparation has already finished. Cancel and reopen setup to change the folder or ports; services will be restored.');
    Exit;
  end;
  PanelPortValue := StrToIntDef(PortsPage.Values[0], 0);
  SDKPortValue := StrToIntDef(PortsPage.Values[1], 0);
  AlexaPortValue := StrToIntDef(PortsPage.Values[2], 0);
  if (PanelPortValue < 1024) or (PanelPortValue > 65535) or (SDKPortValue < 1024) or (SDKPortValue > 65535) or (AlexaPortValue < 1) or (AlexaPortValue > 65535) or (PanelPortValue = SDKPortValue) or (PanelPortValue = AlexaPortValue) or (SDKPortValue = AlexaPortValue) then begin
    Result := LocalText('Escolha três portas TCP diferentes. Painel e SDK: 1024 a 65535. Alexa: 1 a 65535.', 'Choose three different TCP ports. Dashboard and SDK: 1024 to 65535. Alexa: 1 to 65535.');
    Exit;
  end;
  ExtractTemporaryFile('install-path.ps1');
  ExtractTemporaryFile('service-preflight.ps1');
  ExtractTemporaryFile('backup-before-upgrade.ps1');
  Command := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\service-preflight.ps1') + '" -Mode Prepare -Root "' + ExpandConstant('{app}') + '" -PanelPort ' + IntToStr(PanelPortValue) + ' -SDKPort ' + IntToStr(SDKPortValue) + ' -SessionId ' + IntToStr(GetInstallerSessionId) + ' -TempDir "' + ExpandConstant('{tmp}') + '"';
  if not Exec(PowerShellPath, Command, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then Result := LocalText('Não foi possível verificar os serviços.', 'Could not check services.')
  else if (ExitCode >= 0) and (ExitCode <= 3) then begin
    ServiceResumeMask := ExitCode;
    PreparedRoot := WizardDirValue;
    PreflightReady := True;
  end
  else if ExitCode = 40 then Result := LocalText('Uma das portas escolhidas para o painel (', 'A selected dashboard (') + IntToStr(PanelPortValue) + LocalText(') ou SDK (', ') or SDK (') + IntToStr(SDKPortValue) + LocalText(') está ocupada. Volte à página Portas da rede e escolha outra. Os serviços instalados foram mantidos.', ') port is busy. Return to Network ports and choose another one. Installed services were preserved.')
  else if ExitCode = 46 then Result := LocalText('As portas escolhidas são inválidas. Volte à página Portas da rede.', 'Selected ports are invalid. Return to Network ports.')
  else if ExitCode = 41 then Result := LocalText('Outro OpenRGB está em execução. Feche-o antes de instalar para evitar dois programas controlando o mesmo hardware. Os serviços instalados foram mantidos.', 'Another OpenRGB is running. Close it before installation to avoid two programs controlling the same hardware. Installed services were preserved.')
  else if ExitCode = 42 then Result := LocalText('Existe um serviço Nexus de outra pasta. Mantenha a pasta instalada para atualizar; para mudar, desinstale preservando dados e instale novamente.', 'A Nexus service belongs to another folder. Keep the installed folder to upgrade; to relocate, uninstall preserving data and install again.')
  else if ExitCode = 43 then Result := LocalText('Escolha uma pasta exclusiva em disco local NTFS, dentro de uma pasta existente protegida por administradores, sem links. Evite pastas pessoais ou compartilhadas. Em atualizações, mantenha a pasta instalada.', 'Choose a dedicated folder on a local NTFS disk, inside an existing administrator-protected folder without links. Avoid personal or shared folders. Keep the installed folder during upgrades.')
  else if ExitCode = 44 then Result := LocalText('Não foi possível preparar a atualização. Os serviços que estavam ativos foram restaurados.', 'Could not prepare the update. Previously running services were restored.')
  else if ExitCode = 47 then Result := LocalText('Outra sessão de usuário do Windows está executando o Nexus RGB. Feche o aplicativo nas outras sessões antes de continuar.', 'Another Windows user session is running Nexus RGB. Please close the application in other sessions before continuing.')
  else if ExitCode = 48 then Result := LocalText('Uma janela de configuração ou recuperação do Nexus RGB está aberta. Feche-a antes de continuar.', 'A Nexus RGB configuration or recovery window is open. Close it before continuing.')
  else Result := LocalText('Não foi possível preparar ou restaurar os serviços. Código: ', 'Could not prepare or restore services. Code: ') + IntToStr(ExitCode);
end;
function NextButtonClick(CurPageID: Integer): Boolean;
var
  NeedsRestart: Boolean;
  PrepareError: String;
begin
  Result := True;
  if CurPageID = wpReady then begin
    NeedsRestart := False;
    PrepareError := PrepareToInstall(NeedsRestart);
    if PrepareError <> '' then begin
      MsgBox(PrepareError, mbError, MB_OK);
      Result := False;
    end;
  end;
end;
procedure InitializeWizard;
var
  Value: Cardinal;
begin
  PortsPage := CreateInputQueryPage(wpSelectTasks, LocalText('Portas da rede', 'Network ports'), LocalText('Defina as portas usadas pelo Nexus RGB', 'Configure the ports used by Nexus RGB'), LocalText('Mantenha os padrões se estiverem livres. Se outro aplicativo já os usa, escolha outros números. UDP 1900 é fixo para descoberta Alexa; alguns Echos exigem HTTP 80.', 'Keep the defaults if available. Choose other numbers if another app uses them. UDP 1900 is fixed for Alexa discovery; some Echos require HTTP 80.'));
  PortsPage.Add(LocalText('Painel web e celular:', 'Web and phone dashboard:'), False);
  PortsPage.Add(LocalText('SDK OpenRGB (somente neste PC):', 'OpenRGB SDK (this PC only):'), False);
  PortsPage.Add(LocalText('Ponte Alexa (recomendado: 80):', 'Alexa bridge (recommended: 80):'), False);
  if not RegQueryDWordValue(HKLM, 'Software\NexusRGB', 'PanelPort', Value) then Value := 5050;
  PortsPage.Values[0] := ExpandConstant('{param:PANELPORT|' + IntToStr(Value) + '}');
  if not RegQueryDWordValue(HKLM, 'Software\NexusRGB', 'SDKPort', Value) then Value := 6743;
  PortsPage.Values[1] := ExpandConstant('{param:SDKPORT|' + IntToStr(Value) + '}');
  if not RegQueryDWordValue(HKLM, 'Software\NexusRGB', 'AlexaPort', Value) then Value := 80;
  PortsPage.Values[2] := ExpandConstant('{param:ALEXAPORT|' + IntToStr(Value) + '}');
end;
procedure DeinitializeSetup;
var ExitCode: Integer;
begin
  if PreflightReady and not InstallationStarted and (ServiceResumeMask <> 0) then begin
    if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\service-preflight.ps1') + '" -Mode Restore -Root "' + PreparedRoot + '" -RestoreMask ' + IntToStr(ServiceResumeMask), '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then ExitCode := -1;
    if ExitCode <> 0 then MsgBox(LocalText('A instalação foi cancelada, mas não foi possível restaurar os serviços. Abra novamente o instalador para reparar o Nexus RGB. Código: ', 'Setup was canceled but services could not be restored. Reopen the installer to repair Nexus RGB. Code: ') + IntToStr(ExitCode), mbError, MB_OK);
  end;
end;
function NeedRestart: Boolean;
begin
  { Silent setup must report the requirement instead of initiating a reboot. }
  Result := RuntimeNeedsRestart and not WizardSilent;
end;
function GetCustomSetupExitCode: Integer;
begin
  if SetupFailed then Result := 1
  else if RuntimeNeedsRestart then Result := 3010 else Result := 0;
end;
procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and RuntimeNeedsRestart then begin
    WizardForm.NoRadio.Checked := True;
    WizardForm.YesRadio.Checked := False;
  end;
end;
procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  ErrorMessage: String;
  Diagnostic: AnsiString;
  PreviousDiagnostic: AnsiString;
  DiagnosticPath: String;
begin
  if CurStep = ssInstall then InstallationStarted := True;
  if CurStep = ssPostInstall then begin
    { Keep failures nonzero, including runtime installation failures. }
    SetupFailed := True;
    if not Exec(ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException(LocalText('Não foi possível instalar o runtime Microsoft.', 'Could not install the Microsoft runtime.'));
    if (ExitCode <> 0) and (ExitCode <> 3010) and (ExitCode <> 1638) then RaiseException(LocalText('Runtime Microsoft: código ', 'Microsoft runtime: code ') + IntToStr(ExitCode));
    if ExitCode = 3010 then RuntimeNeedsRestart := True;
    if WizardIsTaskSelected('pawnio') then begin
      if not Exec(ExpandConstant('{tmp}\PawnIO_setup.exe'), '', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode) then RaiseException(LocalText('Não foi possível abrir o instalador PawnIO.', 'Could not open the PawnIO installer.'));
      if ExitCode <> 0 then Log(LocalText('O driver PawnIO não foi instalado. Controle USB continua disponível.', 'PawnIO was not installed. USB control remains available.'));
    end;
    try
      DiagnosticPath := ExpandConstant('{commonappdata}\NexusRGB\installation-error.log');
      PreviousDiagnostic := '';
      LoadStringFromFile(DiagnosticPath, PreviousDiagnostic);
      if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Install -PanelPort ' + IntToStr(PanelPortValue) + ' -SDKPort ' + IntToStr(SDKPortValue) + ' -AlexaPort ' + IntToStr(AlexaPortValue), '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException(LocalText('Não foi possível configurar os serviços.', 'Could not configure services.'));
      if ExitCode <> 0 then begin
        ErrorMessage := LocalText('A configuração dos serviços falhou. Código: ', 'Service configuration failed. Code: ') + IntToStr(ExitCode);
        if LoadStringFromFile(DiagnosticPath, Diagnostic) and (Diagnostic <> PreviousDiagnostic) then begin
          ErrorMessage := ErrorMessage + #13#10#13#10 + Copy(UTF8Decode(Diagnostic), 1, 1200);
          ErrorMessage := ErrorMessage + #13#10#13#10 + LocalText('Diagnóstico: ', 'Diagnostic: ') + DiagnosticPath;
        end else
          ErrorMessage := ErrorMessage + #13#10#13#10 + LocalText('Não foi possível gravar um diagnóstico novo. Consulte o log do instalador e ProgramData\NexusRGB\app\service.log.', 'Could not write a new diagnostic. Check the installer log and ProgramData\NexusRGB\app\service.log.');
        RaiseException(ErrorMessage);
      end;
    except
      ErrorMessage := GetExceptionMessage;
      Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Uninstall', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
      RaiseException(ErrorMessage);
    end;
    SetupFailed := False;
  end;
end;
function InitializeUninstall: Boolean;
begin
  Result := not CheckForMutexes('Local\NexusRGB.Tray');
  if not Result then
    SuppressibleMsgBox(LocalText('Feche o ícone do Nexus RGB antes de desinstalar. Os serviços e dados foram mantidos.', 'Close the Nexus RGB tray icon before uninstalling. Services and data were preserved.'), mbInformation, MB_OK, IDOK);
end;
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var ExitCode: Integer;
begin
  if CurUninstallStep = usUninstall then begin
    if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Uninstall', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException(LocalText('Não foi possível parar os serviços antes de desinstalar.', 'Could not stop services before uninstalling.'));
    if ExitCode <> 0 then RaiseException(LocalText('Não foi possível remover os serviços. Código: ', 'Could not remove services. Code: ') + IntToStr(ExitCode));
  end;
end;
