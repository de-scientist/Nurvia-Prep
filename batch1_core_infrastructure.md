# Batch 1: Core Infrastructure

## Files to Commit

### 1. Configuration Files
- src/lib/config/config.ts
- src/lib/config/siteHeaders.ts

### 2. Shared Components  
- src/components/common/NurviaLogo.tsx
- src/components/common/ScrollToTopButton.tsx
- src/components/common/SeoHeader.tsx

### 3. Theme Contexts
- src/lib/contexts/panel/layout/theme/PanelThemeContext.tsx
- src/lib/contexts/web/assessment/theme/ExamThemeContext.tsx

### 4. Utility Components
- src/lib/utils/data/PerPageSelect.tsx
- src/lib/utils/data/SearchBar.tsx

### 5. Panel Tools
- src/components/panel/exam/tools/CustomMiniCalculator.tsx

### 6. Common Modals
- src/components/common/modals/seek/SeekModal.tsx

## Dependencies Analysis
- **Independent**: These files provide shared functionality used by all other components
- **No external dependencies**: Can be committed safely without breaking other features
- **Foundation**: Required for authentication, navigation, and all UI components

## Expected Changes
Based on git status, these appear to be updates to existing files rather than new additions.

## Commit Message Template
```
feat(config): establish core configuration and utility infrastructure

- Add centralized configuration system with environment variables
- Implement shared UI components (logo, scroll-to-top, SEO header)
- Add theme contexts for panel and exam interfaces
- Include utility components (per-page select, search bar)
- Add panel examination tools and common modals

Scope: infrastructure
Validation: All components load without errors
```

## Validation Requirements
- [ ] TypeScript compilation passes
- [ ] ESLint checks pass
- [ ] Components render correctly
- [ ] No circular dependencies
- [ ] All imports resolve