@echo off
echo Instalando pgvector no PostgreSQL 18...
set SRCDIR=%TEMP%\pgvector_build
set PGDIR=C:\Program Files\PostgreSQL\18

copy /Y "%SRCDIR%\vector.dll" "%PGDIR%\lib\"
copy /Y "%SRCDIR%\vector.control" "%PGDIR%\share\extension\"
for %%f in ("%SRCDIR%\sql\vector*.sql") do copy /Y "%%f" "%PGDIR%\share\extension\"

echo.
echo Criando extensao no banco timemachine...
set PGPASSWORD=King@112005
"%PGDIR%\bin\psql.exe" -U postgres -d timemachine -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo.
echo DONE! Pressione qualquer tecla...
pause
