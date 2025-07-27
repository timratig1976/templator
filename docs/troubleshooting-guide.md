# Templator Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Error Messages](#error-messages)
3. [Upload Problems](#upload-problems)
4. [Validation Issues](#validation-issues)
5. [Deployment Failures](#deployment-failures)
6. [Performance Problems](#performance-problems)
7. [Browser Compatibility](#browser-compatibility)
8. [Getting Support](#getting-support)

## Common Issues

### Module Generation Issues

#### Issue: AI fails to detect fields in uploaded design
**Symptoms:**
- "No editable fields detected" error message
- Empty field list after design analysis
- AI processing completes but no fields are found

**Possible Causes:**
- Low image quality or resolution
- Text is too small or unclear
- Design lacks recognizable UI elements
- Unsupported design format

**Solutions:**
1. **Improve Image Quality**
   - Use high-resolution images (minimum 1200px width)
   - Ensure text is clearly readable
   - Use good contrast between text and background

2. **Add Manual Field Hints**
   - Add `data-field` attributes to HTML uploads
   - Use clear, descriptive element names
   - Include placeholder text in form elements

3. **Redesign for Clarity**
   - Make text elements more prominent
   - Use standard UI patterns (buttons, forms, headings)
   - Avoid overly complex or artistic designs

**Example Fix:**
```html
<!-- Before: Unclear element -->
<div class="text">Some content</div>

<!-- After: Clear field definition -->
<div class="text" data-field="main_content" data-type="richtext">
  Main content goes here
</div>
```

#### Issue: Generated module doesn't match design
**Symptoms:**
- Layout differs significantly from uploaded design
- Colors or fonts are incorrect
- Elements are missing or misplaced

**Possible Causes:**
- Complex design with overlapping elements
- Custom fonts not recognized
- Advanced CSS effects not supported
- Responsive design conflicts

**Solutions:**
1. **Simplify Design**
   - Use standard web layouts
   - Avoid complex overlays or effects
   - Use web-safe fonts or provide font files

2. **Manual Adjustments**
   - Edit generated CSS in the code editor
   - Adjust field positions and styling
   - Add custom CSS for specific effects

3. **Use Component Library**
   - Start with pre-built components
   - Customize components to match design
   - Combine multiple components for complex layouts

### Field Configuration Problems

#### Issue: Field validation errors
**Symptoms:**
- Red error indicators on fields
- "Invalid field configuration" messages
- Fields not saving properly

**Common Field Errors:**
1. **Invalid Field Names**
   ```json
   // ❌ Invalid
   {
     "name": "my-field",  // Hyphens not allowed
     "name": "2field",    // Cannot start with number
     "name": "field name" // Spaces not allowed
   }
   
   // ✅ Valid
   {
     "name": "my_field",
     "name": "field_2",
     "name": "field_name"
   }
   ```

2. **Missing Required Properties**
   ```json
   // ❌ Missing required properties
   {
     "name": "title"
     // Missing "label" and "type"
   }
   
   // ✅ Complete field definition
   {
     "name": "title",
     "label": "Page Title",
     "type": "text",
     "required": true
   }
   ```

3. **Invalid Field Types**
   ```json
   // ❌ Invalid type
   {
     "type": "textbox"  // Not a valid HubSpot field type
   }
   
   // ✅ Valid type
   {
     "type": "text"     // Valid HubSpot field type
   }
   ```

**Solutions:**
1. **Follow Naming Conventions**
   - Use only letters, numbers, and underscores
   - Start with a letter
   - Use descriptive names

2. **Include All Required Properties**
   - Always include name, label, and type
   - Add help_text for complex fields
   - Set appropriate default values

3. **Use Valid Field Types**
   - Refer to HubSpot field type documentation
   - Use the field type picker in the UI
   - Test field types in HubSpot before using

## Error Messages

### Validation Errors

#### FIELD_TYPE_INVALID
**Message:** "Invalid field type 'X' is not supported by HubSpot"

**Cause:** Using a field type that doesn't exist in HubSpot

**Solution:**
- Use valid HubSpot field types: text, richtext, image, url, email, etc.
- Check the HubSpot documentation for supported types
- Use the field type dropdown in the editor

#### META_JSON_MISSING
**Message:** "Required file meta.json is missing"

**Cause:** Module package doesn't include the required meta.json file

**Solution:**
- Ensure meta.json is generated during module creation
- Check that all required meta.json fields are present
- Regenerate the module if meta.json is corrupted

#### HTML_SYNTAX_ERROR
**Message:** "Invalid HTML syntax detected"

**Cause:** Generated or edited HTML contains syntax errors

**Solution:**
- Use the built-in HTML validator
- Check for unclosed tags or missing quotes
- Use the auto-fix feature to correct common issues

### Deployment Errors

#### AUTH_FAILED
**Message:** "Authentication failed - invalid credentials"

**Cause:** HubSpot credentials are incorrect or expired

**Solutions:**
1. **Verify Credentials**
   - Check Portal ID is correct
   - Ensure Access Token is valid and not expired
   - Verify token has Design Manager permissions

2. **Regenerate Access Token**
   - Go to HubSpot Settings > Integrations > Private Apps
   - Generate new access token
   - Update credentials in Templator

3. **Check Permissions**
   - Ensure user has Design Manager access
   - Verify account has necessary permissions
   - Contact HubSpot admin if needed

#### UPLOAD_TIMEOUT
**Message:** "Upload timeout - deployment failed"

**Cause:** Network issues or large file size causing timeout

**Solutions:**
1. **Optimize Module Size**
   - Compress images and assets
   - Minify CSS and JavaScript
   - Remove unnecessary files

2. **Check Network Connection**
   - Ensure stable internet connection
   - Try deployment from different network
   - Contact IT if behind corporate firewall

3. **Retry Deployment**
   - Use the retry button
   - Try deploying during off-peak hours
   - Split large modules into smaller components

## Upload Problems

### File Size Issues

#### Issue: "File too large" error
**Maximum Limits:**
- Images: 10MB per file
- HTML files: 5MB
- Total module: 50MB

**Solutions:**
1. **Compress Images**
   - Use image compression tools
   - Convert to appropriate formats (JPEG for photos, PNG for graphics)
   - Resize images to appropriate dimensions

2. **Optimize Code**
   - Minify CSS and JavaScript
   - Remove unused code and comments
   - Use external CDN for large libraries

### Format Issues

#### Issue: "Unsupported file format"
**Supported Formats:**
- Images: PNG, JPG, JPEG, GIF, SVG
- Documents: HTML, CSS, JS
- Archives: ZIP, TAR

**Solutions:**
1. **Convert Files**
   - Convert images to supported formats
   - Save documents as plain text files
   - Use standard file extensions

2. **Check File Headers**
   - Ensure files aren't corrupted
   - Re-save files in correct format
   - Avoid proprietary formats

## Validation Issues

### HubSpot Compliance

#### Issue: Module fails HubSpot validation
**Common Violations:**
1. **Deprecated Properties**
   ```json
   // ❌ Deprecated
   {
     "host_template_types": ["page"]
   }
   
   // ✅ Current
   {
     "content_types": ["page"]
   }
   ```

2. **Missing Required Files**
   - meta.json
   - fields.json
   - module.html

3. **Invalid HubL Syntax**
   ```html
   <!-- ❌ Invalid -->
   {{ module.field_name }}
   
   <!-- ✅ Valid -->
   {{ module.field_name }}
   ```

**Solutions:**
1. **Use Auto-Fix**
   - Run validation with auto-fix enabled
   - Review and approve suggested changes
   - Re-validate after fixes

2. **Manual Corrections**
   - Update deprecated properties
   - Add missing files
   - Fix HubL syntax errors

### Performance Issues

#### Issue: Poor performance scores
**Common Causes:**
- Large file sizes
- Inefficient CSS selectors
- Unoptimized images
- External script dependencies

**Solutions:**
1. **Optimize Assets**
   - Compress and resize images
   - Minify CSS and JavaScript
   - Use efficient CSS selectors

2. **Reduce Dependencies**
   - Remove unused external scripts
   - Inline critical CSS
   - Use lazy loading for images

## Deployment Failures

### Environment Issues

#### Issue: Deployment works in sandbox but fails in production
**Possible Causes:**
- Different permissions between environments
- Production-specific validation rules
- Network restrictions

**Solutions:**
1. **Check Environment Settings**
   - Verify production credentials
   - Ensure same permissions in both environments
   - Test with minimal module first

2. **Gradual Deployment**
   - Deploy to sandbox first
   - Test thoroughly before production
   - Use staging environment if available

### Rollback Issues

#### Issue: Rollback fails or causes problems
**Symptoms:**
- Rollback process hangs
- Module becomes inaccessible
- Data loss after rollback

**Solutions:**
1. **Verify Rollback Target**
   - Ensure target version is valid
   - Check version compatibility
   - Review change log before rollback

2. **Manual Recovery**
   - Use HubSpot Design Manager directly
   - Restore from backup if available
   - Contact support for assistance

## Performance Problems

### Slow Loading

#### Issue: Templator interface loads slowly
**Possible Causes:**
- Slow internet connection
- Browser cache issues
- Server overload

**Solutions:**
1. **Clear Browser Cache**
   - Clear cache and cookies
   - Disable browser extensions
   - Try incognito/private mode

2. **Check Network**
   - Test internet speed
   - Try different network
   - Contact ISP if persistent

### Memory Issues

#### Issue: Browser crashes or becomes unresponsive
**Symptoms:**
- Tab crashes during processing
- Out of memory errors
- Browser freezes

**Solutions:**
1. **Optimize Browser**
   - Close unnecessary tabs
   - Restart browser
   - Update to latest version

2. **Reduce File Sizes**
   - Use smaller images
   - Process files in batches
   - Simplify complex designs

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Common Browser Issues

#### Issue: Features not working in older browsers
**Solutions:**
1. **Update Browser**
   - Use latest version of supported browser
   - Enable automatic updates
   - Clear cache after update

2. **Alternative Browsers**
   - Try different supported browser
   - Use Chrome for best compatibility
   - Avoid Internet Explorer

#### Issue: Upload fails in specific browser
**Solutions:**
1. **Check Browser Settings**
   - Enable JavaScript
   - Allow file uploads
   - Disable strict security settings

2. **Try Alternative Method**
   - Use different browser
   - Try drag-and-drop upload
   - Use direct HTML input

## Getting Support

### Self-Service Options

1. **Knowledge Base**
   - Search help articles
   - Browse by category
   - Check recent updates

2. **Community Forum**
   - Post questions
   - Search existing discussions
   - Share solutions

### Direct Support

1. **Contact Methods**
   - Email: support@templator.com
   - Live chat (business hours)
   - Support ticket system

2. **Information to Include**
   - Error messages (exact text)
   - Steps to reproduce
   - Browser and OS version
   - Screenshots or screen recordings
   - Module files (if relevant)

### Emergency Support

For critical production issues:
- Use priority support channel
- Include "URGENT" in subject line
- Provide business impact details
- Include contact information

### Response Times
- General inquiries: 24-48 hours
- Technical issues: 12-24 hours
- Critical/urgent: 2-4 hours
- Emergency: 1 hour

## Prevention Tips

### Best Practices
1. **Regular Backups**
   - Export modules before major changes
   - Keep version history
   - Document important changes

2. **Testing Strategy**
   - Test in sandbox first
   - Validate before deployment
   - Use staging environment

3. **Stay Updated**
   - Follow Templator updates
   - Check HubSpot changelog
   - Update browser regularly

### Monitoring
1. **Track Performance**
   - Monitor deployment success rates
   - Check module load times
   - Review error logs

2. **User Feedback**
   - Collect user reports
   - Monitor support tickets
   - Track common issues

This troubleshooting guide should help resolve most common issues. For problems not covered here, please contact our support team with detailed information about your specific situation.
