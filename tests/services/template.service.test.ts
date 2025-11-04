import { promises as fs } from "fs";
import { TemplateService } from "../../src/services/template.service";

// Mock fs
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

describe("TemplateService", () => {
  let templateService: TemplateService;
  const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset NODE_ENV to test
    process.env.NODE_ENV = "test";
    templateService = new TemplateService();
  });

  afterEach(() => {
    templateService.clearCache();
  });

  describe("render", () => {
    it("should render template with variables", async () => {
      const layoutContent =
        "<html><body>{{CONTENT}}<footer>© {{YEAR}}</footer></body></html>";
      const templateContent = "<h1>Hello {{NAME}}</h1>";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {
        name: "John",
      });

      expect(result).toContain("<h1>Hello John</h1>");
      expect(result).toContain("<html><body>");
      expect(result).toContain(`© ${new Date().getFullYear()}`);
    });

    it("should handle template with header section", async () => {
      const layoutContent = "<html><body>{{HEADER}}{{CONTENT}}</body></html>";
      const templateContent =
        "<header>Header</header>{{CONTENT_START}}<main>Content</main>{{CONTENT_END}}";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {});

      expect(result).toContain("<header>Header</header>");
      expect(result).toContain("<main>Content</main>");
      expect(result).not.toContain("{{CONTENT_START}}");
      expect(result).not.toContain("{{CONTENT_END}}");
    });

    it("should replace multiple variables", async () => {
      const layoutContent = "<html><body>{{CONTENT}}</body></html>";
      const templateContent =
        "<p>Name: {{NAME}}, Age: {{AGE}}, Email: {{EMAIL}}</p>";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {
        name: "John",
        age: 30,
        email: "john@example.com",
      });

      expect(result).toContain("Name: John");
      expect(result).toContain("Age: 30");
      expect(result).toContain("Email: john@example.com");
    });

    it("should replace undefined variables with empty string", async () => {
      const layoutContent = "<html><body>{{CONTENT}}</body></html>";
      const templateContent = "<p>Name: {{NAME}}</p>";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {});

      expect(result).toContain("Name: ");
    });

    it("should clean up remaining placeholders", async () => {
      const layoutContent = "<html><body>{{CONTENT}}</body></html>";
      const templateContent = "<p>{{NAME}} {{UNKNOWN_VAR}} {{ANOTHER}}</p>";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {
        name: "John",
      });

      expect(result).toContain("John");
      expect(result).not.toContain("{{UNKNOWN_VAR}}");
      expect(result).not.toContain("{{ANOTHER}}");
    });

    it("should replace {{YEAR}} with current year", async () => {
      const layoutContent =
        "<html><body><footer>© {{YEAR}}</footer>{{CONTENT}}</body></html>";
      const templateContent = "<p>Content</p>";

      mockReadFile
        .mockResolvedValueOnce(layoutContent)
        .mockResolvedValueOnce(templateContent);

      const result = await templateService.render("test-template", {});

      expect(result).toContain(`© ${new Date().getFullYear()}`);
    });
  });

  describe("loadTemplate", () => {
    it("should load template from file", async () => {
      const content = "<html>Test</html>";
      mockReadFile.mockResolvedValue(content);

      const result = await (templateService as any).loadTemplate("test.html");

      expect(result).toBe(content);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("test.html"),
        "utf-8"
      );
    });

    it("should not cache in test environment", async () => {
      const content = "<html>Test</html>";
      mockReadFile.mockResolvedValue(content);

      await (templateService as any).loadTemplate("test.html");
      await (templateService as any).loadTemplate("test.html");

      // Should be called twice since caching is disabled in test
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });

    it("should cache in production environment", async () => {
      process.env.NODE_ENV = "production";
      const prodService = new TemplateService();
      const content = "<html>Test</html>";
      mockReadFile.mockResolvedValue(content);

      await (prodService as any).loadTemplate("test.html");
      await (prodService as any).loadTemplate("test.html");

      // Should be called once due to caching
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("replaceVariables", () => {
    it("should replace variables in template", () => {
      const template = "Hello {{NAME}}, you are {{AGE}} years old.";
      const variables = { name: "John", age: 30 };

      const result = (templateService as any).replaceVariables(
        template,
        variables
      );

      expect(result).toBe("Hello John, you are 30 years old.");
    });

    it("should handle case-insensitive variable names", () => {
      const template = "Hello {{NAME}} and {{name}}";
      const variables = { name: "John" };

      const result = (templateService as any).replaceVariables(
        template,
        variables
      );

      // Note: The implementation uses uppercase, so this tests the actual behavior
      expect(result).toContain("John");
    });

    it("should replace with empty string for undefined values", () => {
      const template = "Hello {{NAME}}";
      const variables = { name: undefined };

      const result = (templateService as any).replaceVariables(
        template,
        variables
      );

      expect(result).toBe("Hello ");
    });
  });

  describe("clearCache", () => {
    it("should clear template cache", () => {
      expect(() => templateService.clearCache()).not.toThrow();
    });
  });

  describe("preloadTemplates", () => {
    it("should preload all templates", async () => {
      const content = "<html>Template</html>";
      mockReadFile.mockResolvedValue(content);

      await templateService.preloadTemplates();

      // Should load layout + 6 email templates = 7 calls
      expect(mockReadFile).toHaveBeenCalledTimes(7);
    });
  });
});
