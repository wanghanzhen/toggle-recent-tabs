# Chrome Web Store Listing Draft

## Store name

Toggle Tab

## Summary

Quickly switch between recent tabs with a customizable keyboard shortcut.

## Description

Toggle Tab helps you jump between your most recently used tabs without reaching for the mouse.

Features:

- Tap your shortcut to instantly switch to the previous tab
- Hold the shortcut to open a recent-tab switcher
- Keep pressing the key to move through the list, then release to confirm
- Customize the modifier keys and main key combination
- Works with your existing browsing flow and keeps everything local

How it works:

1. Open the extension popup
2. Press the shortcut you want to use
3. Save the shortcut
4. Use a short press to jump back, or a long press to open the tab picker

Privacy:

- No analytics
- No remote server
- No personal data collection
- All settings are stored locally in the browser

## Permissions justification

### tabs

Needed to read the active tab, track the recent-tab order, and switch to the selected tab.

### storage

Needed to save the user-defined shortcut and recent-tab state locally.

### host access: all sites

Needed because the shortcut is detected by a content script that runs on webpages. The extension does not read page content or send page data anywhere.

## Suggested categories

- Category: Productivity
- Language: English

## Support

Replace with your support email, GitHub repository URL, or homepage before publishing.
