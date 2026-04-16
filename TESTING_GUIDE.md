# WordWeave Usability Testing Guide

This guide will help you verify that the state persistence and language selection fixes are working correctly.

---

## Quick Test (5 minutes)

### Test 1: Language Persistence
1. Click the WordWeave popup icon
2. Select "French (Français)" from the Target Language dropdown
3. Close the popup (click outside or press Escape)
4. Click the popup icon again
5. **Expected**: French should still be selected ✅

### Test 2: Enable/Disable Toggle
1. In the popup, toggle the extension OFF
2. Close the popup
3. Click the popup icon again
4. **Expected**: Toggle should be OFF ✅
5. Toggle it ON
6. Close and reopen popup
7. **Expected**: Toggle should be ON ✅

### Test 3: Quick Action Buttons
1. Enable the extension
2. Visit any website (e.g., a Spanish news site)
3. Click "Translate Now" in the popup
4. **Expected**: Translation should start, progress bar should appear ✅
5. Click "Reset Page"
6. **Expected**: All translations should be removed ✅

---

## Detailed Test Suite (15 minutes)

### Test Set A: State Persistence Across Sessions

**Test A1: Language Settings**
```
1. Open popup
2. Change Target Language to "German (Deutsch)"
3. Change Translation Intensity to "Heavy (35%)"
4. Close popup
5. Close entire extension/browser
6. Reopen browser and extension
7. Check popup → should show German and Heavy selected
```
**Expected Result**: All settings preserved ✅

**Test A2: Toggle State**
```
1. Open popup
2. Disable extension (toggle OFF)
3. Reload browser page
4. Open popup again
5. Check toggle state
6. Click popup and set toggle ON
7. Close popup
8. Reload page
9. Check if page is being translated
```
**Expected Result**: Toggle state persistent, translations active when enabled ✅

**Test A3: Options Page Settings**
```
1. Open Advanced Settings (from popup)
2. Switch to "Appearance" tab
3. Change Highlight Color to #FF0000 (red)
4. Change Font Size to "Large (110%)"
5. Close options page
6. Reopen Advanced Settings
7. Go to Appearance tab again
```
**Expected Result**: Color should be red, font size should be large ✅

---

### Test Set B: Auto-Save Functionality

**Test B1: Language Auto-Save**
```
1. Open Advanced Settings
2. Go to "Translation" tab
3. Change "Target Language" dropdown to "Spanish (Español)"
4. Watch the status message at bottom
5. You should see "Saved" appear briefly
6. Close options page without clicking "Save All Settings"
7. Reopen options page
```
**Expected Result**: Spanish is still selected, auto-save worked ✅

**Test B2: Color Picker Auto-Save**
```
1. Open Advanced Settings
2. Go to "Appearance" tab
3. Click the color picker and select a new color
4. You should see "Saved" message appear
5. Change the color again
6. You should see "Saved" again
```
**Expected Result**: Each color change is auto-saved with visual feedback ✅

---

### Test Set C: Error Recovery

**Test C1: Invalid Settings (if applicable)**
```
1. Open popup
2. Try to change language multiple times rapidly
3. Verify each change is saved without errors
4. No error messages should appear (unless storage is unavailable)
```
**Expected Result**: Settings update smoothly without errors ✅

**Test C2: Network Interruption Simulation**
```
1. Open DevTools (F12)
2. Go to Application/Storage tab
3. Check Storage settings
4. Try changing a setting in options
5. Verify error handling works appropriately
```
**Expected Result**: Graceful error handling with appropriate messages ✅

---

### Test Set D: Popup vs Options Synchronization

**Test D1: Changes in Popup Affect Options**
```
1. Open popup, set Target Language to "Italian"
2. Open Advanced Settings (options page)
3. Go to Translation tab
4. Check Target Language dropdown
```
**Expected Result**: Should show "Italian (Italiano)" ✅

**Test D2: Changes in Options Affect Popup**
```
1. Open Advanced Settings
2. Change Translation Intensity to "Intensive (50%)"
3. Close options page
4. Open popup
5. Check that intensity shows as "Intensive"
6. Look at intensity dots and label
```
**Expected Result**: Intensity should show as 5 dots and "Maximum intensity" ✅

---

### Test Set E: Quick Action Buttons

**Test E1: Translate Now Button**
```
1. Enable extension in popup
2. Visit https://www.bbc.com/mundo (Spanish news site)
3. Wait for initial page load
4. Click "Translate Now" button
5. Observe progress bar
6. Wait for completion
```
**Expected Result**: Page gets translated with progress indication ✅

**Test E2: Reset Page Button**
```
1. After translations are applied
2. Click "Reset Page" button
3. Wait for it to complete
4. Observe page
```
**Expected Result**: All translations removed, original text restored ✅

**Test E3: Exclude Site Button**
```
1. Visit any website
2. Click popup
3. Click "Exclude Site" button
4. Look for confirmation message like "Excluded example.com"
5. Open Advanced Settings → Sites tab
6. Check excluded sites list
```
**Expected Result**: Current site should be in exclusion list ✅

---

## Browser Console Testing (Advanced)

### Enable Debug Mode
Edit `background.js` and change:
```javascript
const DEBUG = true;  // Change from false to true
```

Then check the browser console for detailed logging of all state changes.

---

## Troubleshooting

### Language not persisting?
1. Check that storage permissions are allowed in browser settings
2. Open DevTools → Application → Storage → Local Storage
3. Look for entries starting with "ww_" or containing language codes
4. Try clearing storage and re-setting language

### Toggle not staying?
1. Check browser console for error messages
2. Try disabling browser extensions one by one
3. Test with a fresh Firefox profile
4. Clear browser cache and storage

### Auto-save not showing feedback?
1. Look at the bottom of the options page for status messages
2. Check that messages appear for 1.5 seconds then fade
3. If not appearing, check browser console for JavaScript errors

### Quick actions not working?
1. Make sure extension is enabled (toggle should be ON)
2. Check that you're on a website that has text content
3. Look for error messages in popup status bar
4. Check browser console for detailed error logs

---

## What to Report If Something Goes Wrong

If you encounter issues, please check:

1. **Console Errors**: Open DevTools (F12) and check Console tab
2. **Storage State**: Check that settings are being saved in storage
3. **Message Logs**: If DEBUG=true, check what messages are being sent
4. **Network Activity**: Check if translation API calls are working
5. **Browser Version**: Note your Firefox version

---

## Success Criteria

All tests should show these results:

✅ Language selection persists across sessions  
✅ Enable/disable toggle stays saved  
✅ Auto-save provides visual feedback  
✅ Quick action buttons work properly  
✅ Settings sync between popup and options  
✅ No error messages in normal usage  
✅ Graceful handling if errors occur  

If all tests pass, the usability improvements are working correctly! 🎉
