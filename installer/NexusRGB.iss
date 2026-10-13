#define AppVersion "0.1.0"
#define Payload "..\dist\app"
[Setup]
AppId={{BEFFBF04-40A0-4E59-87C0-223B51E92B84}
AppName=Nexus RGB
AppVersion={#AppVersion}
AppPublisher=Nexus RGB
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
[Icons]
Name: "{group}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"
Name: "{group}\Desinstalar Nexus RGB"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Tasks: desktopicon
Name: "{commonstartup}\Nexus RGB"; Filename: "{app}\NexusRGB.exe"; Parameters: "--tray"; Tasks: traystartup
[Run]
Filename: "{app}\NexusRGB.exe"; Description: "Abrir Nexus RGB"; Flags: nowait postinstall skipifsilent runasoriginaluser
[Code]
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
  if CompareText(RemoveBackslashUnlessRoot(WizardDirValue), RemoveBackslashUnlessRoot(ExpandConstant('{autopf}\Nexus RGB'))) <> 0 then begin
    Result := 'Os serviços precisam ser instalados em Program Files\Nexus RGB para proteger o executável e o controlador de hardware.';
    Exit;
  end;
  Command := '-NoProfile -NonInteractive -Command "& { $ErrorActionPreference=' + '''Stop''' + '; foreach($n in @(' + '''NexusRGB''' + ',' + '''NexusRGBHardware''' + ')){ $s=Get-Service -Name $n -ErrorAction SilentlyContinue; if($s -and $s.Status -ne ' + '''Stopped''' + '){ Stop-Service -Name $n -Force; $s.WaitForStatus(' + '''Stopped''' + ',[TimeSpan]::FromSeconds(30)) } }; if(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in 5050,6743){exit 5}; if(Get-Process -Name OpenRGB -ErrorAction SilentlyContinue){exit 6}; exit 0 }"';
  if not Exec(PowerShellPath, Command, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then Result := 'Não foi possível verificar os serviços.'
  else if ExitCode = 5 then Result := 'As portas 5050 ou 6743 estão ocupadas. Feche o Nexus antigo ou o programa que está usando essas portas e tente novamente.'
  else if ExitCode = 6 then Result := 'Outro OpenRGB está em execução. Feche-o antes de instalar para evitar dois programas controlando o mesmo hardware.'
  else if ExitCode <> 0 then Result := 'Não foi possível preparar os serviços. Código: ' + IntToStr(ExitCode);
end;
procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  ErrorMessage: String;
  Diagnostic: AnsiString;
  DiagnosticPath: String;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível instalar o runtime Microsoft.');
    if (ExitCode <> 0) and (ExitCode <> 3010) and (ExitCode <> 1638) then RaiseException('Runtime Microsoft: código ' + IntToStr(ExitCode));
    if WizardIsTaskSelected('pawnio') then begin
      if not Exec(ExpandConstant('{tmp}\PawnIO_setup.exe'), '', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível abrir o instalador PawnIO.');
      if ExitCode <> 0 then Log('O driver PawnIO não foi instalado. Controle USB continua disponível.');
    end;
    try
      if not Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Install', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then RaiseException('Não foi possível configurar os serviços.');
      if ExitCode <> 0 then begin
        DiagnosticPath := ExpandConstant('{commonappdata}\NexusRGB\installation-error.log');
        ErrorMessage := 'A configuração dos serviços falhou. Código: ' + IntToStr(ExitCode);
        if LoadStringFromFile(DiagnosticPath, Diagnostic) then
          ErrorMessage := ErrorMessage + #13#10#13#10 + Copy(UTF8Decode(Diagnostic), 1, 1200);
        ErrorMessage := ErrorMessage + #13#10#13#10 + 'Diagnóstico: ' + DiagnosticPath;
        RaiseException(ErrorMessage);
      end;
    except
      ErrorMessage := GetExceptionMessage;
      Exec(PowerShellPath, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-services.ps1') + '" -Mode Uninstall', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
      RaiseException(ErrorMessage);
    end;
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
