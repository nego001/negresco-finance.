export const RiskLevel=Object.freeze({LOW:'LOW',ELEVATED:'ELEVATED',HIGH:'HIGH',CRITICAL:'CRITICAL'});
export function assessDeviceRisk(signals={}){
 const reasons=[];
 if(signals.appIntegrity==='FAILED')reasons.push('APP_INTEGRITY_FAILED');
 if(signals.deviceIntegrity==='FAILED')reasons.push('DEVICE_INTEGRITY_FAILED');
 if(signals.overlayDetected===true)reasons.push('SUSPICIOUS_OVERLAY');
 if(signals.screenCaptureActive===true)reasons.push('SCREEN_CAPTURE_ACTIVE');
 if(signals.untrustedNetwork===true)reasons.push('UNTRUSTED_NETWORK');
 if(signals.appIntegrity==='UNKNOWN'||signals.deviceIntegrity==='UNKNOWN')reasons.push('INTEGRITY_UNVERIFIED');
 const critical=reasons.includes('APP_INTEGRITY_FAILED');
 const high=reasons.includes('DEVICE_INTEGRITY_FAILED')||reasons.includes('SUSPICIOUS_OVERLAY');
 const elevated=reasons.length>0;
 return {level:critical?RiskLevel.CRITICAL:high?RiskLevel.HIGH:elevated?RiskLevel.ELEVATED:RiskLevel.LOW,reasons};
}
export function authorizeRiskyOperation({assessment,operation,serverVerified=false}){
 if(!assessment||!Object.values(RiskLevel).includes(assessment.level))return {allowed:false,reason:'INVALID_ASSESSMENT'};
 if(operation!=='read'&&operation!=='payment')return {allowed:false,reason:'UNKNOWN_OPERATION'};
 if(operation==='payment'&&!serverVerified)return {allowed:false,reason:'SERVER_VERIFICATION_REQUIRED'};
 if(operation==='payment'&&assessment.level!==RiskLevel.LOW)return {allowed:false,reason:'RISK_REVIEW_REQUIRED'};
 if(assessment.level===RiskLevel.CRITICAL)return {allowed:false,reason:'APP_INTEGRITY_FAILED'};
 return {allowed:true,reason:'POLICY_ALLOWED'};
}
