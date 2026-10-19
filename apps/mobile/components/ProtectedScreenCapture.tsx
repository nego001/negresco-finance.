import React from 'react';
import {usePreventScreenCapture} from 'expo-screen-capture';
import type {LocalLockStatus} from '../security/localLockPolicy';

/**
 * Android screen privacy for the Guardião and any app with opted-in UI lock.
 * Android uses FLAG_SECURE for screenshots/recording and recent-app thumbnails.
 * The flag is a screen-level privacy measure, NOT encrypted storage or E2EE.
 * Do not use screenshot-detection permissions just to block captures.
 */
export function shouldProtectScreenCapture(page:string,lockStatus:LocalLockStatus):boolean{
 return page==='Guardião'||lockStatus!=='off';
}
export function ProtectedScreenCapture(){
 usePreventScreenCapture('negresco-private-screen');
 return null;
}
