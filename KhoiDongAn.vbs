Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & strDir & "\KhoiDong.bat" & Chr(34), 0
Set WshShell = Nothing
Set fso = Nothing
