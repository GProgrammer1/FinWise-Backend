import { promises as fs } from 'fs';
import path from 'path';

export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

export class TemplateService {
  private templateCache: Map<string, string> = new Map();
  private templatesDir: string;
  private cacheEnabled: boolean;

  constructor() {
    this.templatesDir = path.join(__dirname, '../templates/emails');
    this.cacheEnabled = process.env.NODE_ENV === 'production';
  }

  /**
   * Load and render an email template with variables
   */
  async render(templateName: string, variables: TemplateVariables = {}): Promise<string> {
    // Load layout and template content
    const layout = await this.loadTemplate('layout.html');
    const content = await this.loadTemplate(`${templateName}.html`);

    // Check if template has header section
    let header = '';
    let contentBody = content;

    if (content.includes('{{CONTENT_START}}')) {
      const parts = content.split('{{CONTENT_START}}');
      header = parts[0];
      contentBody = parts[1].replace('{{CONTENT_END}}', '');
    }

    // Replace layout placeholders
    let rendered = layout
      .replace('{{HEADER}}', header)
      .replace('{{CONTENT}}', contentBody)
      .replace('{{YEAR}}', new Date().getFullYear().toString());

    // Replace all variables in the template
    rendered = this.replaceVariables(rendered, variables);

    return rendered;
  }

  /**
   * Load template from file (with optional caching)
   */
  private async loadTemplate(filename: string): Promise<string> {
    // Check cache first
    if (this.cacheEnabled && this.templateCache.has(filename)) {
      return this.templateCache.get(filename)!;
    }

    // Load from file
    const filePath = path.join(this.templatesDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');

    // Cache in production
    if (this.cacheEnabled) {
      this.templateCache.set(filename, content);
    }

    return content;
  }

  /**
   * Replace all variables in template
   */
  private replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace each variable
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key.toUpperCase()}}}`;
      const replacement = value !== undefined ? String(value) : '';
      result = result.split(placeholder).join(replacement);
    });

    // Clean up any remaining placeholders (set to empty string)
    result = result.replace(/\{\{[A-Z_]+\}\}/g, '');

    return result;
  }

  /**
   * Clear template cache (useful for development/testing)
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Preload all templates into cache (useful for production startup)
   */
  async preloadTemplates(): Promise<void> {
    const templates = [
      'layout.html',
      'parent-welcome.html',
      'child-welcome.html',
      'verification-received.html',
      'verification-approved.html',
      'verification-rejected.html',
      'password-reset.html',
    ];

    await Promise.all(
      templates.map(template => this.loadTemplate(template))
    );

    console.log(`Preloaded ${templates.length} email templates`);
  }
}

export const templateService = new TemplateService();
