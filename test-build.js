import { spawn } from 'child_process';

console.log('Starting build test...');

const buildProcess = spawn('npx', ['vite', 'build'], { stdio: 'inherit' });

buildProcess.on('close', (code) => {
  console.log(`Build process exited with code ${code}`);
  
  if (code === 0) {
    console.log('✅ Build successful!');
    
    // Test TypeScript compilation
    console.log('Testing TypeScript compilation...');
    const tscProcess = spawn('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
    
    tscProcess.on('close', (tscCode) => {
      if (tscCode === 0) {
        console.log('✅ TypeScript compilation successful!');
      } else {
        console.log('❌ TypeScript compilation failed with code:', tscCode);
      }
    });
  } else {
    console.log('❌ Build failed with code:', code);
  }
});

buildProcess.on('error', (err) => {
  console.error('❌ Build process error:', err);
});