@echo off
echo.
echo   Relay -- Personal Broadcaster
echo   Setting up your local dev env...
echo.

:: Check Node
node -v >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)
echo   OK Node.js is installed

:: Check/install pnpm
pnpm -v >nul 2>&1
if errorlevel 1 (
  echo   Installing pnpm...
  npm install -g pnpm
)
echo   OK pnpm is installed

:: Install deps
echo.
echo   Installing dependencies...
pnpm install

echo.
echo   Done! Commands:
echo.
echo     pnpm dev                       start dev mode
echo     pnpm lint                      run linter
echo     pnpm typecheck                 TypeScript check
echo     pnpm --filter main dist:win    build .exe installer
echo.
pause
