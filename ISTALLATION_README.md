### USER NODE
## If you just want to use the Plugin as-is:
# Direct INstallation
1. Get the latest .ccx file from the "builds" folder.
2. Install the .ccx file.
3. Enjoy the Plugin.

### Adobe does not allow automatic .ccx creation, so the installation files in the builds folder might not be always be up to date. If you want to make sure you have the latest Version but install it as a .ccx so you do not have to permanently enable developer mode install as describer below and create your own .ccx using the Adobe UXP Developer Tool ###

# Install the Cloud Plugin // coming soon //
1. // coming soon //



### DEV NODE
## If you want to alter the Plugin to your liking you can use the UXP Developer Tool, which is the primary tool for managing UXP plugins.
# To activate an Adobe UXP plugin, follow these steps:

1. Ensure the host application (such as Photoshop, Premiere Pro, or InDesign) is running and compatible with the plugin version.
2. Launch the UXP Developer Tool (UDT).
    When first launched, you may be prompted to enable Developer Mode, which requires elevated permissions and administrative rights.
    If Developer Mode is not already enabled, you can configure it manually by creating a settings.json file in the appropriate directory: /Library/Application Support/Adobe/UXP/Developer on macOS or %CommonProgramFiles%/Adobe/UXP/Developer on Windows.
3. In the UXP Developer Tool, add the plugin by clicking "Add existing plugin" and selecting the manifest.json file from your plugin's folder.
4. Once added, load the plugin into the host application by clicking the "Load" button (or "Load & Watch" for automatic reloading on code changes) in the UXP Developer Tool.
    This action loads the plugin into the application, and its panel should appear, typically accessible via the application's Window menu.
    If changes are made to the manifest.json file, the plugin must be manually unloaded and reloaded to apply the changes.
    To debug the plugin, use the built-in debugging tools within the UXP Developer Tool, which provides a Chrome DevTools-like interface for inspecting console output and testing the Photoshop or other application APIs.
    After activation, the plugin will remain loaded until manually unloaded or the application is restarted. 
    
    For distribution, the plugin can be packaged into a .ccx file using the UXP Developer Tool, which can then be installed by double-clicking on Windows or using the Creative Cloud app.