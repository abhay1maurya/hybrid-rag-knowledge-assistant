# Hybrid RAG - Frontend Documentation

## Project Overview

Welcome to the Hybrid RAG frontend! This is a modern, responsive web interface for a Retrieval-Augmented Generation (RAG) knowledge assistant that allows users to upload documents and query them using AI-powered natural language processing.

## 📁 Project Structure

```
code/
├── chat.html          (Chat Interface)
├── dashboard.html         (Dashboard)
├── doclib.html         (Documents Library)
├── index.html         (Home/Landing Page)
├── login.html         (Login)
├── pricing.html         (Pricing)
├── history.html         (Query History)
├── setting.html         (Settings)
├── support.html         (Support Center)
├── signup.html        (Sign Up)
├── profile.html        (User Profile)
├── sitemap.html       (Site Navigation Overview)
├── site.css           (Global Styles)
├── site.js            (Global JavaScript)
├── screen.png         (Screenshot)
├── assets/            (Images and Icons)
│   ├── icons/         (SVG icons)
│   └── images/        (Logos and images)
└── README.md          (This file)
```

## 🎨 Design System

### Color Palette
- **Brand Color**: #f97316 (Orange)
- **Background**: #0c0c0c (Almost Black)
- **Surface**: #1a1a1a
- **Text Primary**: #f5f5f4 (Light Stone)
- **Text Secondary**: #a8a29e (Muted Stone)

### Typography
- **Font Family**: Space Grotesk (Google Fonts)
- **Weights**: 400, 500, 600, 700

### Components
- Rounded corners: 8px (rounded-lg), 12px (rounded-xl)
- Shadows: Layered with backdrop blur for depth
- Gradients: Multi-directional backgrounds for visual interest

## 📄 Pages Overview

### Public Pages (No Authentication Required)

#### 1. **Home** (index.html)
- Landing page with platform overview
- Call-to-action buttons for signup/login
- Platform snapshot section
- Sticky navigation header

#### 2. **Login** (login.html)
- User authentication form
- Email and password fields
- "Continue as demo user" option
- Link to signup page

#### 3. **Sign Up** (signup.html)
- User registration form
- Company name field
- Password validation (min 8 characters)
- Terms of service agreement
- OAuth options (GitHub, Google)

#### 4. **Pricing** (pricing.html)
- Three pricing tiers (Starter, Pro, Enterprise)
- Feature comparisons
- Plan selection buttons
- Popular plan highlighted

### Dashboard Pages (Authentication Required)

#### 5. **Dashboard** (dashboard.html)
- Main workspace hub
- Statistics cards (Documents, Queries, Response time, Storage)
- Recent activity feed
- Quick action buttons
- Sidebar navigation

#### 6. **Chat** (chat.html)
- Main conversation interface
- Message history display
- AI response with source citations
- Typing indicator animation
- Quick action prompts
- Character counter for textarea

#### 7. **Documents** (doclib.html)
- Document library with table view
- Upload form
- Search and filter functionality
- Document status indicators
- Action buttons (View, Reprocess, Delete)

#### 8. **History** (history.html)
- Query history timeline
- Query details and responses
- Confidence levels
- Source count indicators

### User Pages

#### 9. **Profile** (profile.html)
- User profile card
- Personal information form
- Company information
- Security and privacy settings
- Notification preferences
- Danger zone (account deletion)

#### 10. **Settings** (setting.html)
- Workspace preferences
- Model selection dropdown
- Form save functionality

### Support Pages

#### 11. **Support Center** (support.html)
- Help article links
- Support ticket submission form
- User feedback collection

### Navigation Pages

#### 12. **Sitemap** (sitemap.html)
- Overview of all pages
- Page descriptions
- File references
- Feature summary

## 🛠️ Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Custom styles and animations
- **Tailwind CSS** - Utility-first CSS framework
- **JavaScript (Vanilla)** - Interactivity and form handling
- **Google Fonts** - Space Grotesk typography

## 🔧 Features

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Adaptive layouts and spacing

### Interactive Elements
- Toast notifications
- Form validation
- Button state management
- Smooth transitions (150-300ms)
- Hover effects and animations
- Keyboard shortcuts (Ctrl/Cmd+K focus search)

### Accessibility
- Semantic HTML structure
- ARIA labels where needed
- Focus states on interactive elements
- Proper heading hierarchy
- Color contrast compliance

### Performance Optimizations
- CDN-hosted Tailwind CSS
- Minimal custom JavaScript
- Lazy-loaded assets
- Optimized CSS with utility classes
- No JavaScript dependencies

## 🚀 Getting Started

### Running Locally

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hybrid-rag-knowledge-assistant/code
   ```

2. **Open in browser**
   ```bash
   # Option 1: Use Live Server (VS Code extension)
   # Right-click index or index.html → Open with Live Server
   
   # Option 2: Python HTTP server
   python -m http.server 8000
   
   # Option 3: Node.js HTTP server
   npx http-server
   ```

3. **Navigate to localhost**
   ```
   http://localhost:8000/index.html (or your configured port)
   ```

## 📱 Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🎯 Key User Flows

### 1. First-Time User Flow
```
Home (index.html) 
  → Sign Up (signup.html) 
  → Verify Email 
  → Dashboard (dashboard.html)
```

### 2. Returning User Flow
```
Home (index.html)
  → Login (login.html)
  → Dashboard (dashboard.html)
```

### 3. Chat/Query Flow
```
Dashboard (dashboard.html)
  → Chat (chat.html)
  → Ask Question
  → View AI Response with Sources
  → History (history.html)
```

### 4. Document Management Flow
```
Dashboard (dashboard.html)
  → Documents (doclib.html)
  → Upload New Document
  → View Indexed Documents
```

### 5. Account Management Flow
```
Dashboard (dashboard.html)
  → Profile (profile.html)
  → Update Information
  → Manage Security
  → Settings (setting.html)
```

## 🎨 Customization Guide

### Changing Brand Color
1. Update `--brand` in `site.css`:
   ```css
   :root {
     --brand: #your-color;
   }
   ```

2. Or modify Tailwind config in each HTML file:
   ```javascript
   colors: { brand: '#your-color' }
   ```

### Adding New Pages
1. Create new HTML file in `/code/` directory
2. Copy header/footer structure from existing page
3. Add links in navigation (sidebar in dashboard.html)
4. Update sitemap.html with new page

### Modifying Styles
1. Edit `site.css` for global changes
2. Modify inline Tailwind classes for component-specific changes
3. Use custom CSS classes for complex animations

## 📊 Component Library

### Cards
- Standard card with border and shadow
- Gradient background card
- Interactive hover card
- Status badge card

### Forms
- Text input with focus state
- Textarea with auto-resize
- Select dropdown
- Checkbox with label
- Form validation feedback

### Buttons
- Primary (brand gradient)
- Secondary (border only)
- Danger (red)
- Icon buttons
- Button states (hover, active, disabled)

### Navigation
- Top sticky header
- Sidebar navigation (desktop)
- Breadcrumb navigation
- Footer links

### Alerts & Notifications
- Toast notifications
- Success messages
- Error messages
- Info alerts
- Status badges

## 🔐 Security Considerations

- Form validation (client-side)
- Password strength requirements
- 2FA display in profile
- No sensitive data in localStorage (demo only)
- HTTPS recommended for production

## 🚀 Deployment

### Static Hosting (Recommended)
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront

### Traditional Hosting
- Apache
- Nginx
- Docker container

### Build Process (Optional)
- Minify CSS/JS
- Optimize images
- Generate sourcemaps
- Compress assets

## 📈 Analytics & Tracking

Ready to integrate with:
- Google Analytics
- Mixpanel
- Amplitude
- Custom event tracking

## 🔄 Integration Points

This frontend connects to:
- **Backend API**: RESTful endpoints for authentication, documents, queries
- **AI Service**: LLM inference for chat responses
- **Database**: User data, documents, session management
- **Vector Store**: Document embeddings and retrieval

## 📝 Development Workflow

### Adding a New Feature
1. Create page structure in HTML
2. Add styles to site.css or inline classes
3. Add interactivity in site.js or page-specific script
4. Test responsiveness across devices
5. Update navigation and sitemap

### Bug Fixes
1. Identify affected page/component
2. Check browser console for errors
3. Modify relevant CSS/JS
4. Test in multiple browsers
5. Verify on mobile devices

### Performance Improvements
1. Profile page load times
2. Optimize images and assets
3. Minimize CSS/JS
4. Lazy-load non-critical content
5. Implement caching strategies

## 📚 Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Google Fonts](https://fonts.google.com/)
- [Can I Use](https://caniuse.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

For questions or issues:
1. Check documentation in this README
2. Review existing issues on GitHub
3. Create a new issue with details
4. Contact support team

---

**Last Updated**: March 31, 2026  
**Version**: 1.0.0  
**Status**: Production Ready
