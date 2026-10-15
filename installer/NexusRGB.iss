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
DisableDirPage=yes
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
AppMutex=Local\NexusRGB.Tray
CloseApplications=yes
RestartApplications=no
UsePreviousTasks=yes
[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"
Name: "traystartup"; Description: "Mostrar ícone do Nexus RGB ao entrar no Windows"
Name: "pawnio"; Description: "Abrir instalador do driver assinado PawnIO (RGB da RAM e algumas placas-mãe)"
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\vendor\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "..\vendor\PawnIO_setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "service-preflight.ps1"; Flags: dontcopy
[Icons]
Name: "{group}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"
Name: "{group}\Desinstalar Nexus RGB"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Tasks: desktopicon
Name: "{commonstartup}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Parameters: "--tray"; Tasks: traystartup
[Run]
Filename: "{app}\NexusRGB.exe"; Description: "Abrir Nexus RGB"; Flags: nowait postinstall skipifsilent runasoriginaluser
[Code]
var
  ServiceResumeMask: Integer;
  PreflightReady: Boolean;
  InstallationStarted: Boolean;
  RuntimeNeedsRestart: Boolean;
  SetupFailed: Boolean;
  PortsPage: TInputQueryWizardPage;
  PanelPortValue, SDKPortValue, AlexaPortValue: Integer;
function PowerShellPath: String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
  Command: String;
begin
  Result := '';
  PanelPortValue := StrToIntDef(PortsPage.Values[0], 0);
  SDKPortValue := StrToIntDef(PortsPage.Values[1], 0);
  AlexaPortValue := StrToIntDef(PortsPage.Values[2], 0);
  if (PanelPortValue < 1024) or (PanelPortValue > 65535) or (SDKPortValue < 1024) or (SDKPortValue > 65535) or (AlexaPortValue < 1) or (AlexaPortValue > 65535) or (PanelPortValue = SDKPortValue) or (PanelPortValue = AlexaPortValue) or (SDKPortValue = AlexaPortValue) then begin
    Result := 'Escolha três portas TCP diferentes. Painel e SDK: 1024 a 65535. Alexa: 1 a 65535.';
    Exit;
  end;
  if PreflightReady then Exit;
  if CompareText(RemoveBackslashUnlessRoot(WizardDirValue), RemoveBackslashUnlessRoot(ExpandConstant('{autopf}\Nexus RGB'))) <> 0 then begin
    Result := 'Os serviços precisam ser instalados em Program Files\Nexus RGB para proteger o executável e o controlador de hardware.';
    Exit;
  end;
  ExtractTemporaryFile('service-preflight.ps1');
  Command := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\service-preflight.ps1') + '" -Mode Prepare -Root "' + ExpandConstant('{app}') + '" -PanelPort ' + IntToStr(PanelPortValue) + ' -SDKPort ' + IntToStr(SDKPortValue);
  if not Exec(PowerShellPath, Command, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then Result := 'Não foi possível verificar os serviços.'
  else if (ExitCode >= 0) and (ExitCode <= 3) then begin
    ServiceResumeMask := ExitCode;
    PreflightReady := True;
  end
  else if ExitCode = 40 then Result := 'Uma das portas escolhidas para o painel (' + IntToStr(PanelPortValue) + ') ou SDK (' + IntToStr(SDKPortValue) + ') está ocupada. Volte à página Portas da rede e escolha outra. Os serviços instalados foram mantidos.'
  else if ExitCode = 46 then Result := 'As portas escolhidas são inválidas. Volte à página Portas da rede.'
  else if ExitCode = 41 then Result := 'Outro OpenRGB está em execução. Feche-o antes de instalar para evitar dois programas controlando o mesmo hardware. Os serviços instalados foram mantidos.'
  else if ExitCode = 42 then Result := 'Existe um serviço com o nome Nexus RGB que não pertence a esta instalação. A preparação não alterou esse serviço.'
  else if ExitCode = 43 then Result := 'A pasta de instalação é inválida ou contém um link de sistema de arquivos.'
  else if ExitCode = 44 then Result := 'Não foi possível preparar a atualização. Os serviços que estavam ativos foram restaurados.'
  else Result := 'Não foi possível preparar ou restaurar os serviços. Código: ' + IntToStr(ExitCode);
end;
procedure InitializeWizard;
var
  Value: Cardinal;
begin
  PortsPage := CreateInputQueryPage(wpSelectTasks, 'Portas da rede', 'Defina as portas usadas pelo Nexus RGB', 'Mantenha os padrões se estiverem livres. Se outro aplicativo já os usa, escolha outros números. UDP 1900 é fixo para descoberta Alexa; alguns Echos exigem HTTP 80.');
  PortsPage.Add('Painel web e celular:', False);
  PortsPage.Add('SDK OpenRGB (somente neste PC):', False);
  PortsPage.Add('Ponte Alexa (recomendado: 80):', False);
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
    if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\service-preflight.ps1') + '" -Mode Restore -Root "' + ExpandConstant('{app}') + '" -RestoreMask ' + IntToStr(ServiceResumeMask), '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then ExitCode := -1;
    if ExitCode <> 0 then MsgBox('A instalação foi cancelada, mas não foi possível restaurar os serviços. Abra novamente o instalador para reparar o Nexus RGB. Código: ' + IntToStr(ExitCode), mbError, MB_OK);
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
    if not Exec(ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível instalar o runtime Microsoft.');
    if (ExitCode <> 0) and (ExitCode <> 3010) and (ExitCode <> 1638) then RaiseException('Runtime Microsoft: código ' + IntToStr(ExitCode));
    if ExitCode = 3010 then RuntimeNeedsRestart := True;
    if WizardIsTaskSelected('pawnio') then begin
      if not Exec(ExpandConstant('{tmp}\PawnIO_setup.exe'), '', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível abrir o instalador PawnIO.');
      if ExitCode <> 0 then Log('O driver PawnIO não foi instalado. Controle USB continua disponível.');
    end;
    try
      DiagnosticPath := ExpandConstant('{commonappdata}\NexusRGB\installation-error.log');
      PreviousDiagnostic := '';
      LoadStringFromFile(DiagnosticPath, PreviousDiagnostic);
      if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Install -PanelPort ' + IntToStr(PanelPortValue) + ' -SDKPort ' + IntToStr(SDKPortValue) + ' -AlexaPort ' + IntToStr(AlexaPortValue), '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível configurar os serviços.');
      if ExitCode <> 0 then begin
        ErrorMessage := 'A configuração dos serviços falhou. Código: ' + IntToStr(ExitCode);
        if LoadStringFromFile(DiagnosticPath, Diagnostic) and (Diagnostic <> PreviousDiagnostic) then begin
          ErrorMessage := ErrorMessage + #13#10#13#10 + Copy(UTF8Decode(Diagnostic), 1, 1200);
          ErrorMessage := ErrorMessage + #13#10#13#10 + 'Diagnóstico: ' + DiagnosticPath;
        end else
          ErrorMessage := ErrorMessage + #13#10#13#10 + 'Não foi possível gravar um diagnóstico novo. Consulte o log do instalador e ProgramData\NexusRGB\app\service.log.';
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
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var ExitCode: Integer;
begin
  if CurUninstallStep = usUninstall then begin
    if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Uninstall', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível parar os serviços antes de desinstalar.');
    if ExitCode <> 0 then RaiseException('Não foi possível remover os serviços. Código: ' + IntToStr(ExitCode));
  end;
end;
