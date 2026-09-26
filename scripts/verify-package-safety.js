/**
 * Automated Package Safety Check for DegreeTrack
 * Ensures that the package identity is strictly and consistently `com.degreetrack.quiz`
 * across all project configurations and avoids regression to `com.degreetrack.app`.
 */
const fs = require('fs');
const path = require('path');

const EXPECTED_PACKAGE = 'com.degreetrack.quiz';
const FORBIDDEN_PACKAGE = 'com.degreetrack.app';

let hasErrors = false;

function checkFile(filePath, regex, description, expected) {
  if (!fs.existsSync(filePath)) {
    console.error(`[PACKAGE SAFETY ERROR] File not found: ${filePath}`);
    hasErrors = true;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!regex.test(content)) {
    console.error(`[PACKAGE SAFETY ERROR] ${description} in ${filePath} does not match expected "${expected}"!`);
    hasErrors = true;
  }

  if (content.includes(FORBIDDEN_PACKAGE)) {
    console.error(`[PACKAGE SAFETY ERROR] Found forbidden legacy identifier "${FORBIDDEN_PACKAGE}" in ${filePath}!`);
    hasErrors = true;
  }
}

console.log('Running DegreeTrack Package Safety Verification...');

// 1. Check capacitor.config.ts
checkFile(
  path.join(__dirname, '..', 'capacitor.config.ts'),
  new RegExp(`appId:\\s*['"\`]${EXPECTED_PACKAGE}['"\`]`),
  'Capacitor appId',
  EXPECTED_PACKAGE
);

// 2. Check android/app/build.gradle
checkFile(
  path.join(__dirname, '..', 'android', 'app', 'build.gradle'),
  new RegExp(`namespace\\s*=\\s*['"\`]${EXPECTED_PACKAGE}['"\`]`),
  'Android namespace',
  EXPECTED_PACKAGE
);

checkFile(
  path.join(__dirname, '..', 'android', 'app', 'build.gradle'),
  new RegExp(`applicationId\\s*['"\`]${EXPECTED_PACKAGE}['"\`]`),
  'Android applicationId',
  EXPECTED_PACKAGE
);

// 3. Check strings.xml
checkFile(
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  new RegExp(`<string name="package_name">${EXPECTED_PACKAGE}</string>`),
  'strings.xml package_name',
  EXPECTED_PACKAGE
);

checkFile(
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  new RegExp(`<string name="custom_url_scheme">${EXPECTED_PACKAGE}</string>`),
  'strings.xml custom_url_scheme',
  EXPECTED_PACKAGE
);

// 4. Check MainActivity.java
checkFile(
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'degreetrack', 'quiz', 'MainActivity.java'),
  new RegExp(`package\\s+${EXPECTED_PACKAGE};`),
  'MainActivity package declaration',
  EXPECTED_PACKAGE
);

if (hasErrors) {
  console.error('\n❌ Package safety verification FAILED! Correct the package discrepancies above.');
  process.exit(1);
} else {
  console.log(`✅ Package safety verification PASSED: All configurations consistently use "${EXPECTED_PACKAGE}".\n`);
}
