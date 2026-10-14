-- Print58: drop receipt PDFs or images (HEIC, JPEG, PNG...) on the app, or
-- open it and pick them in Finder.  PDFs run through print58.sh, images through
-- printimg58.sh (both bundled in Contents/Resources), which stop after each
-- receipt so it can be torn off.

on run
	try
		set picked to choose file with prompt "Choose receipt PDFs or images to print on the 58mm printer" of type {"com.adobe.pdf", "public.image"} with multiple selections allowed
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
		set ext to ""
		if p contains "." then set ext to do shell script "printf %s " & quoted form of p & " | sed 's/.*\\.//' | tr A-Z a-z"
		if ext is in {"pdf", "heic", "heif", "jpg", "jpeg", "png", "gif", "tif", "tiff", "bmp", "webp"} then
			set args to args & " " & quoted form of p
			set n to n + 1
		end if
	end repeat
	if n is 0 then
		display alert "Print58" message "Only PDFs and images (HEIC, JPEG, PNG...) can be printed."
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
