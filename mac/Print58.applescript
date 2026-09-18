-- Print58: drop receipt PDFs on the app, or open it and pick them in Finder.
-- Everything runs through print58.sh (bundled in Contents/Resources), which
-- stops after each receipt so it can be torn off.

on run
	try
		set picked to choose file with prompt "Choose receipt PDFs to print on the 58mm printer" of type {"com.adobe.pdf"} with multiple selections allowed
	on error number -128
		return
	end try
	printFiles(picked)
end run

on open dropped
	printFiles(dropped)
end open

on printFiles(theFiles)
	set args to ""
	set n to 0
	repeat with f in theFiles
		set p to POSIX path of f
		if p ends with ".pdf" or p ends with ".PDF" then
			set args to args & " " & quoted form of p
			set n to n + 1
		end if
	end repeat
	if n is 0 then
		display alert "Print58" message "Only PDF files can be printed. Drop the receipt PDFs downloaded from the bill generator."
		return
	end if
	set runner to POSIX path of (path to resource "run.sh")
	try
		set out to do shell script "/bin/bash " & quoted form of runner & args
		if out is not "" then display notification (last paragraph of out) with title "Print58"
	on error errMsg number errNum
		if errNum is not -128 then display alert "Print58 could not print" message errMsg as critical
	end try
end printFiles
