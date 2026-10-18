# Shared by setup preflight, service registration and recovery. No action on import.
function Get-NexusRegisteredInstallRoot {
  $entry=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{BEFFBF04-40A0-4E59-87C0-223B51E92B84}_is1' -ErrorAction SilentlyContinue
  if($entry.InstallLocation){return [IO.Path]::GetFullPath($entry.InstallLocation).TrimEnd('\')}
  return $null
}
function Assert-NexusInstallAcl($Acl,[bool]$Leaf) {
  $trusted=@('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
  if($Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $trusted){throw 'Installation parent must be owned by Administrators, SYSTEM or TrustedInstaller.'}
  $unsafe=[Security.AccessControl.FileSystemRights]'Delete,DeleteSubdirectoriesAndFiles,ChangePermissions,TakeOwnership'
  if($Leaf){$unsafe=$unsafe -bor [Security.AccessControl.FileSystemRights]::Write}
  foreach($rule in $Acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
    if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $trusted -and
       -not ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and
       ($rule.FileSystemRights -band $unsafe)){throw 'Installation path can be changed by an unprivileged account.'}
  }
}
function Assert-NexusInstallPath([string]$Directory,[switch]$Prepare) {
  if($Directory -notmatch '^[A-Za-z]:\\' -or $Directory.Length -gt 180 -or $Directory.Substring(2) -match '[:"<>|?*]' -or $Directory -match '[. ](?:\\|$)'){throw 'Choose an absolute local installation folder.'}
  $full=[IO.Path]::GetFullPath($Directory).TrimEnd('\')
  $volume=[IO.Path]::GetPathRoot($full)
  if($full.Length -le 3){throw 'Do not install into a drive root.'}
  $drive=[IO.DriveInfo]::new($volume)
  if($drive.DriveType -ne 'Fixed' -or $drive.DriveFormat -ne 'NTFS'){throw 'Choose a fixed local NTFS disk.'}
  # Do not take ownership of Windows, user data, ProgramData or an existing shared folder.
  foreach($reserved in @([Environment]::GetFolderPath('Windows'),[Environment]::GetFolderPath('CommonApplicationData'),(Join-Path $env:SystemDrive 'Users'),[Environment]::GetFolderPath('ProgramFiles'),[Environment]::GetFolderPath('ProgramFilesX86'))) {
    if($reserved -and [String]::Equals($full,$reserved.TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){throw 'Choose a dedicated Nexus RGB subfolder.'}
  }
  $registered=Get-NexusRegisteredInstallRoot
  if($registered -and -not [String]::Equals($full,$registered,[StringComparison]::OrdinalIgnoreCase)){throw 'Keep the installed directory during upgrades. Uninstall first to relocate, preserving app data.'}
  $walk=[IO.DirectoryInfo]::new($full).Parent
  $standard=[String]::Equals($full,(Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Nexus RGB'),[StringComparison]::OrdinalIgnoreCase)
  while($walk) {
    if(-not $walk.Exists -or ($walk.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Choose an existing parent without filesystem links.'}
    # Preserve the existing system Program Files location policy. Custom roots
    # additionally require protected ancestors; never change a drive/shared ACL.
    if(-not $standard){Assert-NexusInstallAcl (Get-Acl -LiteralPath $walk.FullName) $false}
    $walk=$walk.Parent
  }
  if(Test-Path -LiteralPath $full) {
    $item=Get-Item -LiteralPath $full -Force
    if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Invalid installation folder.'}
    if(-not $registered -and @(Get-ChildItem -LiteralPath $full -Force).Count -gt 0){throw 'Choose an empty, dedicated folder for a new installation.'}
    if(-not $Prepare -or -not $registered){Assert-NexusInstallAcl (Get-Acl -LiteralPath $full) $true}
  } elseif(-not $Prepare){throw 'Installation folder is missing.'}
  if($Prepare) {
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true,$false)
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    foreach($sid in @('S-1-5-18','S-1-5-32-544','S-1-5-19','S-1-5-32-545')) {
      $rights=if($sid -in 'S-1-5-18','S-1-5-32-544'){'FullControl'}else{'ReadAndExecute'}
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),$rights,'ContainerInherit,ObjectInherit','None','Allow'))
    }
    # Create with a protected DACL before Inno copies any executable into the folder.
    if(-not (Test-Path -LiteralPath $full)){[IO.DirectoryInfo]::new($full).Create($acl)}
    else {Set-Acl -LiteralPath $full -AclObject $acl}
    Assert-NexusInstallAcl (Get-Acl -LiteralPath $full) $true
  }
}
