# Called after the owned services stop and before any payload is replaced.
# Reads only settings and original effect JSON; never copies drivers or sessions.
function Save-NexusUpgradeBackup([string]$AppData) {
  $rootPath=[IO.Path]::GetFullPath($AppData)
  $settingsPath=Join-Path $rootPath 'settings.json'
  if(-not (Test-Path -LiteralPath $settingsPath)){return}
  $walk=Get-Item -LiteralPath $rootPath -Force
  while($walk) {if(($walk.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not ($walk -is [IO.DirectoryInfo])){throw 'Backup directory contains a filesystem link.'}; $walk=$walk.Parent}
  $settingsFile=Get-Item -LiteralPath $settingsPath -Force
  if($settingsFile.PSIsContainer -or ($settingsFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $settingsFile.Length -gt 2MB){throw 'Invalid settings file for backup.'}
  # Preserve exact key casing in third-party effect parameters. PowerShell 5.1
  # ConvertFrom-Json rejects otherwise valid objects containing Speed and speed.
  $settings=[IO.File]::ReadAllText($settingsPath)
  if(-not $settings.TrimStart().StartsWith('{')){throw 'Invalid settings JSON for backup.'}
  $effects=@();$effectsPath=Join-Path $rootPath 'effects'
  if(Test-Path -LiteralPath $effectsPath) {
    $effectDirectory=Get-Item -LiteralPath $effectsPath -Force
    if(-not $effectDirectory.PSIsContainer -or ($effectDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Invalid effects directory for backup.'}
    foreach($file in Get-ChildItem -LiteralPath $effectsPath -Force) {
      if($file.Name -notmatch '^[a-f0-9]{24}\.json$'){continue}
      if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -gt 256KB){throw 'Invalid effect file for backup.'}
      $value=[IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
      if($value.original -isnot [string] -or [Text.Encoding]::UTF8.GetByteCount($value.original) -gt 128KB){throw 'Invalid effect source for backup.'}
      $effects+=@{id=$file.BaseName;original=$value.original}
      if($effects.Count -gt 67){throw 'Too many effects for backup.'}
    }
  }
  $encodedEffects=ConvertTo-Json -InputObject @($effects) -Depth 80 -Compress
  $backup='{"format":"nexus-backup/1","version":"0.1.0","createdAt":"'+[DateTime]::UtcNow.ToString('o')+'","settings":'+$settings+',"effects":'+$encodedEffects+'}'
  if([Text.Encoding]::UTF8.GetByteCount($backup) -gt 16MB){throw 'Backup exceeds 16 MiB.'}
  $folder=Join-Path $rootPath 'backups'
  if(Test-Path -LiteralPath $folder){$item=Get-Item -LiteralPath $folder -Force;if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Invalid backup directory.'}}
  else{New-Item -ItemType Directory -Path $folder | Out-Null}
  $target=Join-Path $folder ('before-update-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmss')+'-'+[Guid]::NewGuid().ToString('N')+'.json')
  $temporary=$target+'.tmp'
  try{[IO.File]::WriteAllText($temporary,$backup,[Text.UTF8Encoding]::new($false));[IO.File]::Move($temporary,$target)}finally{if(Test-Path -LiteralPath $temporary){[IO.File]::Delete($temporary)}}
}
