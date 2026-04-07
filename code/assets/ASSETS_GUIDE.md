# Assets Guide

## Overview

This directory contains all image assets used in the Hybrid RAG frontend application.

## Directory Structure

```
assets/
├── icons/           - SVG icons (scalable, optimized)
├── images/          - Image files (logos, screenshots, backgrounds)
└── ASSETS_GUIDE.md  - This file
```

## Icons

All icons are in SVG format for scalability and optimization.

### Available Icons

1. **chat.svg** - Chat/message bubble icon
   - Use: Chat page header, message indicators
   - Dimensions: 24x24 (recommended)

2. **document.svg** - Document/file icon
   - Use: Document library, file uploads
   - Dimensions: 24x24 (recommended)

3. **settings.svg** - Settings/gear icon
   - Use: Settings page, preferences
   - Dimensions: 24x24 (recommended)

4. **user.svg** - User/profile icon
   - Use: User profile, account menu
   - Dimensions: 24x24 (recommended)

5. **help.svg** - Help/support icon
   - Use: Support page, help buttons
   - Dimensions: 24x24 (recommended)

6. **home.svg** - Home icon
   - Use: Home button, navigation
   - Dimensions: 24x24 (recommended)

7. **trending-up.svg** - Analytics/growth icon
   - Use: Dashboard stats, trending content
   - Dimensions: 24x24 (recommended)

8. **info.svg** - Info icon
   - Use: Informational tooltips, help text
   - Dimensions: 24x24 (recommended)

9. **upload.svg** - Upload icon
   - Use: Upload buttons, file input
   - Dimensions: 24x24 (recommended)

10. **zap.svg** - Lightning/power icon
    - Use: Performance indicators, speed metrics
    - Dimensions: 24x24 (recommended)

11. **eye.svg** - View/visibility icon
    - Use: Preview buttons, view actions
    - Dimensions: 24x24 (recommended)

12. **database.svg** - Database icon
    - Use: Data storage, indexing indicators
    - Dimensions: 24x24 (recommended)

## Usage Examples

### Inline SVG Icon
```html
<img src="assets/icons/chat.svg" alt="Chat" width="24" height="24" />
```

### SVG with CSS Class
```html
<svg class="w-6 h-6 text-brand">
  <use xlink:href="assets/icons/chat.svg#icon"></use>
</svg>
```

### Icon with Tailwind Classes
```html
<img src="assets/icons/chat.svg" alt="Chat" class="w-6 h-6 text-brand" />
```

### In CSS Background
```css
.icon-chat {
  background: url('assets/icons/chat.svg') center / contain no-repeat;
  width: 24px;
  height: 24px;
}
```

## Images Directory

### Placeholder Images
- **logo-light.png** - Light theme logo
- **logo-dark.png** - Dark theme logo
- **favicon.ico** - Browser tab icon
- **og-image.png** - Open Graph preview image

### Screenshots
- **screenshot-chat.png** - Chat interface preview
- **screenshot-dashboard.png** - Dashboard preview
- **screenshot-documents.png** - Documents page preview

## Adding New Assets

### For SVG Icons
1. Save as `.svg` in `assets/icons/`
2. Ensure stroke-based design (not filled shapes)
3. Set stroke-width to 2
4. Use currentColor for color inheritance
5. Set viewBox to "0 0 24 24"

### For Images
1. Save in appropriate subdirectory
2. Optimize using tools like TinyPNG
3. Use WebP format when possible
4. Provide fallback PNG versions

### Naming Convention
- Use **lowercase** names
- Separate words with **hyphens**
- Examples: `icon-chat.svg`, `logo-light.png`

## Optimization Tips

### SVG Icons
- Remove unnecessary attributes
- Use <symbol> for reusable icons
- Test at different sizes
- Ensure proper viewBox ratios

### Images
- Compress with tools like TinyPNG, ImageOptim
- Use appropriate formats (PNG for UI, JPG for photos)
- Provide 2x versions for retina displays (@2x)
- Consider WebP for modern browsers

## Performance Metrics

- **SVG Icons**: ~500 bytes average
- **PNG Images**: ~50-100KB (optimized)
- **Total Assets Size**: ~1MB (fully optimized)

## Accessibility

- All icons have descriptive `alt` attributes
- SVG icons use **currentColor** for theme compatibility
- High contrast ratios maintained
- Icons are not the sole method of conveying information

## Browser Support

- All SVG icons: Modern browsers (IE 11+)
- PNG images: All browsers
- WebP: Chrome, Edge, Firefox, Opera

## Color Scheme

### Light Theme
- Text: #000000
- Icons: #f97316 (brand)
- Backgrounds: Transparent

### Dark Theme (Current)
- Text: #f5f5f4 (light stone)
- Icons: #f97316 (brand)
- Backgrounds: Transparent

## Responsive Usage

### Mobile (< 640px)
- Icon sizes: 20x20 to 24x24
- Image widths: 100% or 90vw

### Tablet (640px - 1024px)
- Icon sizes: 24x24 to 32x32
- Image widths: 80% or 600px

### Desktop (> 1024px)
- Icon sizes: 24x24 to 48x48
- Image widths: 70% or auto

## CDN Integration

Future CDN integration options:
- **Cloudinary**: Image optimization & delivery
- **Unpkg**: CDN for SVG icons
- **jsDelivr**: Fast global delivery
- **AWS CloudFront**: Custom domain delivery

## Favicon Setup

Add to HTML head:
```html
<link rel="icon" type="image/x-icon" href="assets/images/favicon.ico">
<link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
```

## Attribution & Licenses

- **SVG Icons**: Custom created or from free sources
- **Fonts**: Google Fonts (free, open source)
- **Design System**: Brand colors and guidelines

## Future Improvements

- [ ] Create animation-optimized SVG versions
- [ ] Add icon sprite sheet for performance
- [ ] Implement dark/light mode variants
- [ ] Create icon font fallback
- [ ] Add WebP variants for all images
- [ ] Implement lazy loading for images

---

**Last Updated**: March 31, 2026  
**Format Version**: 1.0  
**Total Assets**: 12 icons + placeholders
