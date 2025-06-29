# Deployment Guide - Iran-Israel Conflict Map

## GitHub Pages Hosting

### Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/Paulkelvin/iran-israel-conflict-map
2. Click on "Settings" tab
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select "Deploy from a branch"
5. Choose "main" branch and "/ (root)" folder
6. Click "Save"

### Step 2: Wait for Deployment

- GitHub Pages will automatically build and deploy your site
- This usually takes 2-5 minutes
- You'll see a green checkmark when deployment is complete

### Step 3: Access Your Live Site

Your site will be available at:
```
https://paulkelvin.github.io/iran-israel-conflict-map/
```

### Step 4: Update README with Live URL

Once deployed, update the README.md file to include the live URL:

```markdown
## Live Demo
Access the live application at: https://paulkelvin.github.io/iran-israel-conflict-map/
```

## Alternative Hosting Options

### Netlify (Recommended Alternative)

1. Go to [netlify.com](https://netlify.com)
2. Sign up/Login with GitHub
3. Click "New site from Git"
4. Select your repository
5. Deploy settings:
   - Build command: (leave empty for static site)
   - Publish directory: `/` (root)
6. Click "Deploy site"

### Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your repository
5. Deploy settings:
   - Framework Preset: Other
   - Root Directory: `./`
6. Click "Deploy"

## Important Notes

### API Key Security
- Your MapTiler API key is currently in the code
- For production, consider using environment variables
- Monitor your API usage to avoid exceeding limits

### Custom Domain (Optional)
- In GitHub Pages settings, you can add a custom domain
- Update your DNS settings accordingly
- This gives you a professional URL like `yourdomain.com`

### Performance Optimization
- GitHub Pages serves static files efficiently
- Your GeoJSON files are optimized for web delivery
- Consider CDN for global performance if needed

## Troubleshooting

### Site Not Loading
- Check if GitHub Pages is enabled
- Verify all files are in the main branch
- Check browser console for errors

### Map Not Displaying
- Verify MapTiler API key is valid
- Check API usage limits
- Ensure all GeoJSON files are accessible

### Performance Issues
- Monitor file sizes (especially GeoJSON)
- Consider data compression
- Test on different devices/browsers 