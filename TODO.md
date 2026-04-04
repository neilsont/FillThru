# Resume Upload & Vercel Build Fix - TODO

## Steps from Approved Plan:
- [x] Step 1: Update package.json (remove pdf-parse deps, add pdfjs-dist)\n- [x] Step 2: Update next.config.ts (remove serverExternalPackages)\n- [x] Step 3: Update src/app/api/resume/upload/route.ts (replace PDF parsing with PDF.js)
- [x] Step 4: Run `npm install`\n- [x] Step 5: Run `npm run build` (✓ Success - no errors, Vercel build fixed)
- [ ] Step 6: Test upload locally with `npm run dev`
- [ ] Step 7: Deploy/push to Vercel

