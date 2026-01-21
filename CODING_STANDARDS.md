## Universal Coding Best Practices (Language-Agnostic, Evidence-Aligned)

### 1) Clarity and Readability
- Descriptive, consistent naming
- Consistent formatting enforced by formatter/linter
- Simple, explicit code; avoid unnecessary cleverness

### 2) Design and Maintainability
- Single responsibility
- Clear modular boundaries with small, well-defined interfaces
- Prefer composition over deep inheritance
- DRY: reduce duplication without over-abstraction
- Dependencies minimal, explicit, and intentional

### 3) Correctness and Reliability
- Input validation and explicit error handling
- Deterministic behavior; avoid hidden side effects
- Assertions and invariants where appropriate
- Fail fast when assumptions are violated

### 4) Testing
- Automated tests (unit, integration as appropriate)
- Deterministic and isolated tests
- Regression tests for previously fixed bugs

### 5) Security
- Treat all external input as untrusted
- Apply least-privilege principles
- No hard-coded secrets or credentials
- Secure defaults and configuration
- Safe output encoding where applicable
- Use well-reviewed, vetted libraries for security-sensitive functionality

### 6) Performance
- Measure before optimizing
- Choose appropriate algorithms and data structures
- Optimize only proven bottlenecks

### 7) Collaboration and Change Control
- Consistent version control usage
- Small, focused commits with meaningful messages
- Code review before merge
- Document non-obvious decisions and trade-offs

### 8) Portability and Longevity
- Avoid undefined or implementation-specific behavior
- Prefer standard language features over proprietary extensions
- Keep code understandable without specialized or tribal knowledge

### 9) Documentation, Hygiene, and Continuous Improvement
- Document intent and architectural decisions (the "why")
- Keep comments accurate and current
- Remove dead code
- Refactor incrementally and pay down technical debt continuously

### Optional (Context-Dependent)
- Continuous integration with automated builds, tests, and quality gates
- Reproducible dependency management (e.g., pinning/lockfiles) where applicable

## Typical Weighting (Non-Performance-Critical Systems)
- Clarity + Maintainability + Correctness + Testing: ~70%
- Security + Collaboration + Portability: ~25%
- Performance: ~5% (unless performance-critical)
