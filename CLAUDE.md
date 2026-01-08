# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi Database Script Tool (MDbScriptTool) is a Windows Forms desktop application that runs SQL scripts against multiple MSSQL databases simultaneously. It targets environments where `USE` statements aren't allowed (e.g., Azure SQL).

**Stack:** C# (.NET Framework 4.8), CefSharp (Chromium 86), JavaScript/HTML/CSS frontend with CodeMirror editor.

## Build Commands

Building requires Visual Studio with Web Essentials 2019 extension.

```bash
# Fresh clone/download - run in order:
# 1. Restore NuGet packages (right-click solution → Restore NuGet Packages)
# 2. Compile LESS/CSS (right-click project → Web Compiler → Re-compile all files)
# 3. Update bundles (right-click project → Bundler & Minifier → Update Bundles)
# 4. Rebuild Solution
```

MSBuild from command line:
```bash
msbuild MDbScriptTool.sln /p:Configuration=Release /p:Platform=x64
```

Output: `bin\x64\Release\MDbScriptTool.exe` (or x86)

## Architecture

### C# ↔ JavaScript Bridge Pattern

The app uses a custom event bridge between C# backend and JavaScript frontend:

- **OsEvent** (`OsEvent.cs`): C# emits events to JavaScript via `window.os._emit()`
- **UiEvent** (`UiEvent.cs`): JavaScript calls C# via `window.uiEvent.Emit()`
- **AppHandlers.cs**: All C# event handlers registered here (SQL execution, settings, file operations)

### Key Event Handlers (AppHandlers.cs)
- `execute-sql`: Executes SQL against selected databases
- `parse-sql`: Validates SQL syntax
- `fetch-connection-dbs`: Lists available databases on a connection
- `get-settings` / `set-settings`: Settings CRUD

### Frontend Structure (Scripts/app/)
- `core.js`: EventEmitter implementation
- `app.js`: Main application logic and utilities
- `content-editor.js`: CodeMirror integration
- `content-result.js`: SQL result display
- `cm-tsql-mode.js`: Custom TSQL syntax highlighting
- `cm-tsql-fold.js`: Code folding for BEGIN/END blocks

### Entry Points
- **C# Entry:** `AppContext.cs` - Main method, single-instance mutex, command-line parsing
- **Main Window:** `App.cs` - WinForms window hosting CefSharp browser
- **HTML Entry:** `app.tt.html` → `app.html` (T4 template generates HTML)

### Custom File System Scheme
- `fs:///` scheme handler in `FileSystemSchemeHandlerFactory.cs` serves local files to the browser

## Key Patterns

### Settings Storage
Settings stored as JSON in `{AppDirectory}/Data/settings`. Keys defined in `Constants.Settings` class. Thread-safe via `ConcurrentDictionary`.

### Password Encryption
`Crypto.cs` uses DPAPI (`ProtectedData.Protect()`) with random salt for connection passwords.

### SQL Execution
SQL is parsed by `GO` statements and executed sequentially against each selected database. Connection pooling is used.

### Logging
Multi-target logging via `CompositeLogger` pattern in `Logging/` directory. SQL execution logs stored in `Data/Logs/`.

## Asset Pipeline

- **LESS → CSS:** `compilerconfig.json` defines compilation (source: `Content/app/css/*.less`)
- **JS Bundling:** `bundleconfig.json` defines bundles (app.min.js, cm-tsql-mode.min.js, etc.)
- **T4 Template:** `app.tt` generates `app.html` with conditional Debug/Release includes

## Platform Notes

- Builds for both x86 and x64 platforms
- Requires .NET Framework 4.8
- CefSharp binaries are platform-specific
- Command-line args: `--vs` (debug mode), `--data-dir`, `--app-dir`, `--single-instance`
