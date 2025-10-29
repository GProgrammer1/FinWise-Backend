# Email Templates

Email templates for FinWise notifications, externalized for easy editing and maintenance.

## Template System

### How It Works

1. **Layout Template** (`layout.html`)
   - Shared layout for all emails
   - Contains header, footer, and styling
   - Placeholders: `{{HEADER}}`, `{{CONTENT}}`, `{{YEAR}}`

2. **Content Templates** (e.g., `parent-welcome.html`)
   - Individual email content
   - Uses `{{CONTENT_START}}` and `{{CONTENT_END}}` markers
   - Can include custom header section before `{{CONTENT_START}}`

3. **Variable Replacement**
   - Use `{{VARIABLE_NAME}}` syntax (uppercase)
   - Replaced at render time by TemplateService
   - Common variables: `{{NAME}}`, `{{REASON}}`, etc.

### Available Templates

| Template | Purpose | Variables |
|----------|---------|-----------|
| `parent-welcome.html` | Welcome email for new parent accounts | `{{NAME}}` |
| `child-welcome.html` | Welcome email for new child accounts | `{{NAME}}` |
| `verification-received.html` | Confirmation of verification submission | `{{NAME}}` |
| `verification-approved.html` | Account verification approval | `{{NAME}}` |
| `verification-rejected.html` | Additional info needed for verification | `{{NAME}}`, `{{REASON}}` |

## Creating New Templates

### Step 1: Create Template File

Create a new `.html` file in this directory:

```html
<div class="header">
  <h1>Your Custom Header</h1>
</div>

{{CONTENT_START}}
<h2>Hello {{NAME}},</h2>

<p>Your custom email content here.</p>

<div class="info-box">
  <strong>Important Information</strong>
  <p>Use info boxes for callouts.</p>
</div>

<p>Best regards,<br><strong>The FinWise Team</strong></p>
{{CONTENT_END}}
```

### Step 2: Add Method to MailerService

```typescript
async sendCustomEmail(email: string, name: string): Promise<void> {
  await this.sendTemplateEmail(
    email,
    'Email Subject Line',
    'your-template-name', // without .html
    { name } // variables object
  );
}
```

### Step 3: Use in Controller

```typescript
await mailerService.sendCustomEmail(user.email, user.name);
```

## Template Variables

### Common Variables

- `{{NAME}}` - User's name
- `{{EMAIL}}` - User's email
- `{{REASON}}` - Reason for action (rejections, etc.)
- `{{YEAR}}` - Current year (auto-populated)
- `{{LINK}}` - Action link/URL
- `{{CODE}}` - Verification code

### Custom Variables

Add any custom variables in the `variables` object:

```typescript
await templateService.render('template-name', {
  name: 'John Doe',
  customVar: 'Custom Value',
  amount: '1000.00',
});
```

Use in template:
```html
<p>Hello {{NAME}}, your {{CUSTOMVAR}} is {{AMOUNT}}.</p>
```

## Styling

### CSS Classes Available

#### Headers
- `.header` - Default purple gradient
- `.header.success` - Green gradient
- `.header.warning` - Orange/yellow gradient

#### Content Boxes
- `.info-box` - Default info box (purple border)
- `.info-box.success` - Success box (green border)
- `.info-box.warning` - Warning box (red border)

#### Typography
- `<h2>` - Section heading
- `<p>` - Body text
- `<strong>` - Bold text
- `<ul>`, `<li>` - Lists

#### Example

```html
<div class="info-box success">
  <strong>Success!</strong>
  <p>Your action was completed successfully.</p>
</div>

<div class="info-box warning">
  <strong>Warning</strong>
  <p>Please review the following information.</p>
</div>
```

## Best Practices

### 1. Keep Templates Simple
- Use semantic HTML
- Minimal inline styles (rely on layout CSS)
- Mobile-responsive by default

### 2. Variable Naming
- Use UPPERCASE for all variables
- Be descriptive: `{{VERIFICATION_LINK}}` not `{{LINK}}`
- Document required variables in comments

### 3. Testing
- Preview templates locally
- Test on multiple email clients
- Check mobile rendering
- Verify all variables are replaced

### 4. Accessibility
- Use semantic HTML tags
- Include alt text for images
- Ensure good color contrast
- Provide plain text fallback

## Template Caching

### Development
- Templates are **not cached**
- Changes reflect immediately
- Restart not needed

### Production
- Templates are **cached** on first load
- Clear cache: `templateService.clearCache()`
- Preload on startup: `templateService.preloadTemplates()`

## Troubleshooting

### Missing Variables

If a variable is not provided, it will be replaced with empty string:

```html
Hello {{NAME}},  <!-- If NAME not provided -->
Hello ,          <!-- Renders as this -->
```

Always provide all required variables.

### Template Not Found

Error: `ENOENT: no such file or directory`

- Check template filename is correct
- Ensure file is in `src/templates/emails/`
- Don't include `.html` in the template name when calling `render()`

### Broken Layout

If layout appears broken:
- Check `{{CONTENT_START}}` and `{{CONTENT_END}}` markers
- Ensure layout.html exists
- Verify HTML is well-formed (closing tags)

## Email Client Compatibility

Templates tested on:
- ✅ Gmail (Web, iOS, Android)
- ✅ Apple Mail (macOS, iOS)
- ✅ Outlook (Windows, Web)
- ✅ Yahoo Mail
- ✅ Mobile clients

### Known Limitations
- Some email clients strip certain CSS
- Background images may not work everywhere
- Prefer inline styles for critical styling
- Always test on target platforms

## Localization (Future)

To support multiple languages:

1. Create language-specific template directories:
```
src/templates/emails/
  en/
    parent-welcome.html
  fr/
    parent-welcome.html
  ar/
    parent-welcome.html
```

2. Update TemplateService to accept locale parameter

3. Load appropriate template based on user's language preference

## Resources

- [Email Client CSS Support](https://www.caniemail.com/)
- [MJML Framework](https://mjml.io/) - For complex layouts
- [Nodemailer Documentation](https://nodemailer.com/)
- [HTML Email Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)
