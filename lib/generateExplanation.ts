import type { RiskAssessment } from './riskEngine';

export function generateExplanation(risk: RiskAssessment): string {
  const { riskScore, riskLevel, findings } = risk;

  if (riskLevel === 'critical') {
    return (
      `This website has critical security vulnerabilities with a risk score of ${riskScore}/100. ` +
      `Immediate action is required. Key issues: ${findings.slice(0, 3).join('; ')}. ` +
      `These misconfigurations create exploitable attack vectors that could lead to data breaches or site compromise.`
    );
  }

  if (riskLevel === 'high') {
    return (
      `This website has significant security gaps with a risk score of ${riskScore}/100. ` +
      `While not immediately exploitable in all cases, these issues increase attack surface. ` +
      `Primary concerns: ${findings.slice(0, 3).join('; ')}.`
    );
  }

  if (riskLevel === 'medium') {
    return (
      `This website has a moderate security posture with a risk score of ${riskScore}/100. ` +
      `Core protections may be missing but the site is not immediately at high risk. ` +
      `Recommended improvements: ${findings.slice(0, 2).join('; ')}.`
    );
  }

  return (
    `This website has a strong security posture with a risk score of ${riskScore}/100. ` +
    `${findings.length === 0 ? 'All major security controls are in place.' : `Minor improvements possible: ${findings.join('; ')}.`}`
  );
}
