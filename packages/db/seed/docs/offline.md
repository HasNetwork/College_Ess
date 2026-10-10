---
title: Offline Support & Synchronization
kind: guide
audience: user
order: 4
minRole: student
published: true
---
# Offline Support & Synchronization

College Ess keeps a copy of what you need on your device, so a bad connection doesn't stop you.

## What Works Offline
- **This guide.** Once you've opened it, every page stays on your device.
- **What College Ess last synced for you.** It stays on this device and is brought up to date when College Ess can be reached again.

## What Needs a Connection
- **Signing up and signing in.**
- **Saving a setting.** If you're offline, Settings tells you the change wasn't saved.
- **Uploading a photo.** Your photo stays on screen until you can try again.

## Replay on Reconnect
When College Ess can be reached again:
1. Your queued changes are sent in the order you made them.
2. For plain attributes, such as a task's title, the change that reaches the server last wins. If you edit the same task on two devices, the device that syncs last decides what it says.
3. For accumulating events (such as logging wears), every event survives independently so counts are never lost.
4. If the server refuses a change for good, for example because you no longer have permission, it moves to **Failed** in the sync status. Tap **Retry** to send it again, or **Dismiss** to drop it.
5. If College Ess keeps failing to save a change, it stops after 10 tries and shows it under **Failed**, so nothing is lost without you knowing. Tap **Retry** once things work again.

## "Can't Reach College Ess"
The sync status shows you're offline whenever College Ess doesn't answer, even if your phone shows full Wi-Fi. On campus Wi-Fi this usually means the network's sign-in page is waiting: open any website, sign in to the Wi-Fi, and your changes go on their own.

## If You're Asked to Sign In Again
When your session has expired, your changes wait on this device. Sign in again and they're sent.

## Signing Out With Unsent Changes
If you sign out before your changes were sent, College Ess tells you how many there are. Signing out anyway deletes them from this device, so nobody who uses it after you can see or send them. Cancel to keep them: they're sent the next time College Ess can be reached.

## Changes From Your Other Devices
What you change on another phone or computer shows up here the next time College Ess syncs: when you open it, come back to it, or reconnect. Deletions sync too, so a task you delete on your laptop disappears from your phone.
