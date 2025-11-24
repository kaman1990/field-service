# Design Patterns and Rules for Field Asset Management App

This document outlines the design patterns and conventions that should be followed when building and maintaining this application. These patterns ensure consistency across Assets, Points, Gateways, and any future entities.

## Code Style and TypeScript Conventions

### Code Style
- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files: exported component, subcomponents, helpers, static content, types
- Follow Expo's official documentation: https://docs.expo.dev/

### TypeScript Usage
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use maps instead
- Use functional components with TypeScript interfaces
- Use strict mode in TypeScript for better type safety

### Syntax and Formatting
- Use the "function" keyword for pure functions
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements
- Use declarative JSX
- Use Prettier for consistent code formatting

### Naming Conventions
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Favor named exports for components

## Service Layer Pattern

### PowerSync Initialization
- **Always use `getInitializedPowerSync()`** instead of `getPowerSync()`
- This ensures PowerSync is fully initialized before use
- All service methods should be `async` and await the PowerSync instance
- Example:
  ```typescript
  async getEntityById(id: string): Promise<Entity | null> {
    const powerSync = await getInitializedPowerSync();
    return await powerSync.getOptional<Entity>(
      'SELECT * FROM entities WHERE id = ?',
      [id]
    );
  }
  ```

### Update Method Pattern
All update methods must follow this pattern:

1. **Get initialized PowerSync instance**
2. **Check for initialization errors**
3. **Build dynamic update query** with all possible fields
4. **Handle data types consistently:**
   - Convert booleans to integers (0/1) for SQLite
   - Handle null values explicitly
   - Preserve empty strings (don't convert to null)
5. **Update `updated_at` timestamp**
6. **Return the updated entity with error handling**

Example:
```typescript
async updateEntity(id: string, entity: Partial<Entity>): Promise<Entity> {
  const powerSync = await getInitializedPowerSync();
  if (!powerSync || !powerSync.execute) {
    throw new Error('PowerSync is not initialized. Please ensure the app is connected.');
  }
  
  const updates: string[] = [];
  const params: any[] = [];
  
  // Build dynamic update query for all possible fields
  const fields: (keyof Entity)[] = [
    'field1',
    'field2',
    'booleanField',
    // ... all fields
  ];
  
  for (const field of fields) {
    if (entity[field] !== undefined) {
      updates.push(`${field} = ?`);
      const value = entity[field];
      if (typeof value === 'boolean') {
        params.push(value ? 1 : 0);
      } else if (value === null) {
        params.push(null);
      } else if (value === '') {
        params.push('');
      } else {
        params.push(value);
      }
    }
  }
  
  if (updates.length === 0) {
    const result = await powerSync.get<Entity>(
      'SELECT * FROM entities WHERE id = ?',
      [id]
    );
    if (!result) {
      throw new Error('Entity not found');
    }
    return result;
  }
  
  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  
  await powerSync.execute(
    `UPDATE entities SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
  
  const result = await powerSync.get<Entity>(
    'SELECT * FROM entities WHERE id = ?',
    [id]
  );
  if (!result) {
    throw new Error('Failed to retrieve updated entity');
  }
  return result;
}
```

### Service Method Structure
All services should implement:
- `getAll(filters?)` - Get all entities with optional filters
- `getById(id)` - Get single entity by ID
- `create(entity)` - Create new entity
- `update(id, partialEntity)` - Update existing entity
- `delete(id)` - Soft delete (set enabled = false)

## Form Screen Pattern

### Data Loading Strategy
- **Use PowerSync `useQuery`** (from `@powersync/react`) for loading existing entity data
  - This enables real-time updates when data changes
  - Use `getTableName()` helper for table name resolution
- **Use React Query `useQuery`** (from `@tanstack/react-query`) for lookup data
  - Sites, areas, statuses, etc. are loaded via React Query
  - These are typically static reference data

Example:
```typescript
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { getTableName } from '../../lib/powersync-queries';

// Load existing entity with PowerSync (real-time)
const entitiesTable = getTableName('entities');
const { data: entityResults = [] } = useQuery<Entity>(
  isEditing ? `SELECT * FROM ${entitiesTable} WHERE id = ?` : '',
  isEditing ? [entityId] : []
);
const entity = entityResults?.[0] || null;
const entityLoading = isEditing && !entity && entityResults.length === 0;

// Load lookup data with React Query
const { data: sites = [] } = useReactQuery({
  queryKey: ['sites'],
  queryFn: () => lookupService.getSites(),
});
```

### Form State Management
- Initialize form data with default values
- Use `useEffect` to load entity data into form when available
- Ensure string fields are always strings (use `?? ''` for null/undefined)
- Example:
  ```typescript
  useEffect(() => {
    if (entity && isEditing) {
      const initialFormData: Partial<Entity> = {
        ...entity,
        description: entity.description ?? '',
      };
      setFormData(initialFormData);
    }
  }, [entity, isEditing]);
  ```

### Mutations
- Use React Query `useMutation` for create and update operations
- Invalidate relevant queries on success
- Navigate back on success using `router.back()` or `router.replace()`
- Show error alerts on failure

Example:
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

const createMutation = useMutation({
  mutationFn: (data: Partial<Entity>) => entityService.createEntity(data as any),
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['entities'] });
    // Navigate to detail screen for new entity, or back for edit
    router.replace(`/entities/${data.id}`);
  },
  onError: (error: any) => {
    Alert.alert('Error', error.message || 'Failed to create entity');
  },
});
```

### Validation
- Always validate required fields before submitting
- Show user-friendly error messages
- Example:
  ```typescript
  const handleSave = () => {
    if (!formData.name) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }
    // ... proceed with save
  };
  ```

### Loading States
- Show loading indicator when loading existing entity for edit
- Disable save button during mutation
- Example:
  ```typescript
  if (entityLoading && isEditing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  
  const isLoading = createMutation.isPending || updateMutation.isPending;
  ```

## Expo Router Layout Structure

This app uses **Expo Router** for file-based routing. Routes are defined by the file structure in the `app/` directory.

### Directory Structure
```
app/
├── _layout.tsx              # Root layout (handles auth, PowerSync, global providers)
├── index.tsx                # Initial route (redirects based on auth)
├── sign-in.tsx              # Sign-in screen
└── (tabs)/                  # Tab navigator group
    ├── _layout.tsx          # Tabs layout (bottom tab bar)
    ├── assets/
    │   ├── _layout.tsx      # Stack navigator for assets
    │   ├── index.tsx        # Asset list screen
    │   ├── new.tsx          # New asset form
    │   ├── [assetId].tsx    # Asset detail screen
    │   ├── [assetId]/
    │   │   └── edit.tsx     # Edit asset form
    │   └── points/
    │       ├── index.tsx    # Points list
    │       ├── new.tsx      # New point form
    │       ├── [pointId].tsx # Point detail
    │       └── [pointId]/
    │           └── edit.tsx # Edit point form
    ├── gateways/
    │   ├── _layout.tsx      # Stack navigator for gateways
    │   ├── index.tsx        # Gateway list screen
    │   ├── new.tsx          # New gateway form
    │   ├── [gatewayId].tsx  # Gateway detail screen
    │   └── [gatewayId]/
    │       └── edit.tsx     # Edit gateway form
    ├── dashboard/
    │   ├── _layout.tsx      # Stack navigator for dashboard
    │   └── index.tsx       # Dashboard screen
    └── settings/
        ├── index.tsx        # Settings screen
        └── debug.tsx        # PowerSync debug screen
```

### Layout Hierarchy
1. **Root Layout** (`app/_layout.tsx`):
   - Wraps entire app
   - Handles authentication state
   - Initializes PowerSync
   - Provides QueryClient and PowerSyncContext
   - Manages global navigation redirects

2. **Tabs Layout** (`app/(tabs)/_layout.tsx`):
   - Bottom tab navigator
   - Defines tabs: Dashboard, Assets, Gateways, Settings
   - Sets `initialRouteName="dashboard"` (or appropriate default)

3. **Stack Layouts** (e.g., `app/(tabs)/assets/_layout.tsx`):
   - Stack navigator for each tab section
   - Handles nested navigation within each tab
   - Defines screen options and titles

### Route Naming Conventions
- **Index routes**: `index.tsx` files are the default route for a directory
- **Dynamic routes**: `[param].tsx` files create dynamic routes (e.g., `[assetId].tsx`)
- **Nested routes**: Subdirectories create nested routes (e.g., `assets/points/`)
- **Groups**: `(tabs)` is a route group (doesn't appear in URL but groups routes)

### Route Examples
- `/` → `app/index.tsx` (redirects based on auth)
- `/sign-in` → `app/sign-in.tsx`
- `/(tabs)/assets` → `app/(tabs)/assets/index.tsx`
- `/(tabs)/assets/new` → `app/(tabs)/assets/new.tsx`
- `/(tabs)/assets/[assetId]` → `app/(tabs)/assets/[assetId].tsx`
- `/(tabs)/assets/[assetId]/edit` → `app/(tabs)/assets/[assetId]/edit.tsx`
- `/(tabs)/assets/points?assetId=123` → `app/(tabs)/assets/points/index.tsx` (with query param)

## Navigation Patterns

### Using Expo Router Hooks
- Import: `import { useRouter, useLocalSearchParams } from 'expo-router';`
- Get router: `const router = useRouter();`
- Get params: `const { assetId } = useLocalSearchParams<{ assetId: string }>();`

### Create Navigation (from List Screens)
- **Standalone entities**: `router.push('/gateways/new')`
- **Nested entities**: `router.push(`/assets/points/new?assetId=${assetId}`)`
- Use query parameters for parent IDs: `?assetId=123`

### Edit Navigation (from Detail Screens)
- **Standalone entities**: `router.push(`/gateways/${gatewayId}/edit`)`
- **Nested entities**: `router.push(`/assets/points/${pointId}/edit?assetId=${assetId}`)`
- Always include parent ID in query params for nested entities

### View Detail Navigation (from List Screens)
- **Standalone entities**: `router.push(`/gateways/${item.id}`)`
- **Nested entities**: `router.push(`/assets/points/${item.id}?assetId=${assetId}`)`
- Use dynamic route segments for entity IDs

### Navigation Methods
- **`router.push(path)`**: Navigate to a new screen (adds to stack)
- **`router.replace(path)`**: Replace current screen (no back button)
- **`router.back()`**: Go back to previous screen
- **`router.canGoBack()`**: Check if back navigation is possible

### Route Parameter Access
- **Dynamic segments**: Use `[param].tsx` files and access via `useLocalSearchParams()`
  ```typescript
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  ```
- **Query parameters**: Pass via URL query string and access via `useLocalSearchParams()`
  ```typescript
  router.push(`/assets/points?assetId=${assetId}`);
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  ```

### Route Parameter Naming
- Use consistent naming: `assetId`, `gatewayId`, `pointId`
- For nested entities, always include parent ID in query params: `?assetId=${assetId}`
- Type the params: `useLocalSearchParams<{ assetId: string; pointId?: string }>()`

### Authentication Routing
- **Initial route**: `app/index.tsx` checks auth and redirects
- **Authenticated**: Redirects to `/(tabs)/dashboard`
- **Not authenticated**: Redirects to `/sign-in`
- **Auth state changes**: Handled in `app/_layout.tsx` with `useEffect` hooks

## Dashboard Pattern

### Dashboard Structure
- **Location**: `app/(tabs)/dashboard/index.tsx`
- **Layout**: `app/(tabs)/dashboard/_layout.tsx` (required for Expo Router)
- **Purpose**: Display overview statistics and key metrics

### Dashboard Layout File Requirement
- **Every tab directory MUST have a `_layout.tsx` file** for Expo Router to recognize it
- Even if the dashboard only has an `index.tsx`, create a minimal layout:
  ```typescript
  import { Stack } from 'expo-router';

  export default function DashboardLayout() {
    return (
      <Stack>
        <Stack.Screen
          name="index"
          options={{ title: 'Dashboard', headerShown: false }}
        />
      </Stack>
    );
  }
  ```

### Dashboard Data Querying Pattern
- **Use PowerSync `useQuery`** for real-time entity counts and stats
- **Use React Query `useQuery`** for lookup data (statuses, etc.)
- Query only necessary fields for performance:
  ```typescript
  // Query minimal fields needed for stats
  const { data: allAssets = [] } = useQuery<Asset>(
    `SELECT id, iot_status_id, install_approved FROM ${assetsTable} WHERE enabled = ?`,
    [1]
  );
  ```

### Dashboard Stats Calculation
- Use `useMemo` to calculate derived stats from queried data
- Handle boolean fields that may be stored as integers (0/1):
  ```typescript
  // Handle both boolean and integer values
  if (asset.install_approved === true || asset.install_approved === 1) {
    stats.installApproved++;
  }
  ```
- Parse status names from lookup tables to determine installation status
- Group stats by status categories (installed, not installed, partially installed, etc.)

### Dashboard UI Components
- **Stat Cards**: Large, clickable cards showing total counts
- **Detail Cards**: Expandable sections showing breakdowns by status
- **Stat Rows**: Individual stat lines within detail cards
- Use consistent styling with shadows, rounded corners, and proper spacing

### Dashboard Navigation
- Stat cards should be clickable and navigate to relevant list screens
- Example: Assets card navigates to `/(tabs)/assets`
- Use `router.push()` for navigation

## Data Handling Conventions

### Boolean Fields
- Store as integers in SQLite (0 = false, 1 = true)
- Convert when reading/writing:
  - Reading: SQLite returns 0/1, TypeScript types use boolean
  - Writing: Convert boolean to 0/1 in update methods

### Null vs Empty String
- **Null**: Use for "not set" or "no value"
- **Empty String**: Use for "explicitly cleared" or "user entered empty"
- **Preserve empty strings** in updates (don't convert to null)
- This allows PowerSync to track changes properly

### Timestamps
- Always update `updated_at` on entity updates
- Use ISO string format: `new Date().toISOString()`
- Set both `created_at` and `updated_at` on create

## PowerSync Query Patterns

### Table Name Resolution
- Always use `getTableName()` helper for table names
- This handles schema variations (public.entities vs entities)
- Example:
  ```typescript
  const entitiesTable = getTableName('entities');
  const { data } = useQuery<Entity>(
    `SELECT * FROM ${entitiesTable} WHERE id = ?`,
    [entityId]
  );
  ```

### Query Building
- Use helper functions in `lib/powersync-queries.ts` for complex queries
- These handle table name resolution and filter building
- Example: `buildAssetsQuery()`, `buildGatewaysQuery()`, `buildPointsQuery()`

## File Structure Conventions

### Services
- Location: `services/`
- Naming: `{entity}.ts` (e.g., `assets.ts`, `gateways.ts`, `points.ts`)
- Export: `export const {entity}Service = { ... }`

### Form Screens (Expo Router)
- Location: `app/(tabs)/{entity}/new.tsx` or `app/(tabs)/{entity}/[id]/edit.tsx`
- Naming: Default export function (e.g., `export default function NewAssetScreen()`)
- Pattern: Follow the standardized form screen pattern above
- Use `useRouter()` and `useLocalSearchParams()` from `expo-router`
- Navigate using `router.push()`, `router.replace()`, or `router.back()`

### List Screens (Expo Router)
- Location: `app/(tabs)/{entity}/index.tsx`
- Use PowerSync `useQuery` for real-time data
- Include search and filter functionality
- Navigate to detail/edit screens using `router.push()`

### Detail Screens (Expo Router)
- Location: `app/(tabs)/{entity}/[id].tsx`
- Use PowerSync `useQuery` for real-time data
- Include edit button that navigates to form screen
- Access route params via `useLocalSearchParams()`

## UI and Styling

### UI Components
- Use Expo's built-in components for common UI patterns and layouts
- Implement responsive design with Flexbox and Expo's `useWindowDimensions` for screen size adjustments
- Use styled-components or Tailwind CSS for component styling (this project uses NativeWind/Tailwind)
- Implement dark mode support using Expo's `useColorScheme`
- Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props
- Leverage `react-native-reanimated` and `react-native-gesture-handler` for performant animations and gestures

### Safe Area Management
- Use `SafeAreaProvider` from `react-native-safe-area-context` to manage safe areas globally in your app
- Wrap top-level components with `SafeAreaView` to handle notches, status bars, and other screen insets on both iOS and Android
- Use `SafeAreaScrollView` for scrollable content to ensure it respects safe area boundaries
- Avoid hardcoding padding or margins for safe areas; rely on `SafeAreaView` and context hooks

## Performance Optimization

### State Management
- Minimize the use of `useState` and `useEffect`; prefer context and reducers for state management
- Use React Context and `useReducer` for managing global state
- Leverage React Query for data fetching and caching; avoid excessive API calls

### Performance Best Practices
- Use Expo's `AppLoading` and `SplashScreen` for optimized app startup experience
- Optimize images: use WebP format where supported, include size data, implement lazy loading with `expo-image`
- Implement code splitting and lazy loading for non-critical components with React's `Suspense` and dynamic imports
- Profile and monitor performance using React Native's built-in tools and Expo's debugging features
- Avoid unnecessary re-renders by memoizing components and using `useMemo` and `useCallback` hooks appropriately

## Error Handling and Validation

### Error Handling Patterns
- Use Zod for runtime validation and error handling
- Implement proper error logging using Sentry or a similar service
- Prioritize error handling and edge cases:
  - Handle errors at the beginning of functions
  - Use early returns for error conditions to avoid deeply nested if statements
  - Avoid unnecessary else statements; use if-return pattern instead
  - Implement global error boundaries to catch and handle unexpected errors
- Use `expo-error-reporter` for logging and reporting errors in production
- Always provide user-friendly error messages

### Validation
- Always validate required fields before submitting
- Show user-friendly error messages
- Use Zod schemas for form validation when appropriate

## Testing

### Testing Strategy
- Write unit tests using Jest and React Native Testing Library
- Implement integration tests for critical user flows using Detox
- Use Expo's testing tools for running tests in different environments
- Consider snapshot testing for components to ensure UI consistency

## Security

### Security Best Practices
- Sanitize user inputs to prevent XSS attacks
- Use `react-native-encrypted-storage` for secure storage of sensitive data
- Ensure secure communication with APIs using HTTPS and proper authentication
- Use Expo's Security guidelines to protect your app: https://docs.expo.dev/guides/security/

## Internationalization (i18n)

### Localization
- Use `react-native-i18n` or `expo-localization` for internationalization and localization
- Support multiple languages and RTL layouts
- Ensure text scaling and font adjustments for accessibility

## Key Expo Conventions

1. Rely on Expo's managed workflow for streamlined development and deployment
2. Prioritize Mobile Web Vitals (Load Time, Jank, and Responsiveness)
3. Use `expo-constants` for managing environment variables and configuration
4. Use `expo-permissions` to handle device permissions gracefully
5. Implement `expo-updates` for over-the-air (OTA) updates
6. Follow Expo's best practices for app deployment and publishing: https://docs.expo.dev/distribution/introduction/
7. Ensure compatibility with iOS and Android by testing extensively on both platforms
8. Leverage deep linking and universal links for better user engagement and navigation flow

## General Rules

1. **Consistency First**: When adding new entities, follow existing patterns exactly
2. **Real-time Updates**: Use PowerSync queries for entity data that needs real-time updates
3. **Static Data**: Use React Query for lookup/reference data
4. **Error Handling**: Always provide user-friendly error messages
5. **Validation**: Validate required fields before submission
6. **Loading States**: Show appropriate loading indicators
7. **Type Safety**: Use TypeScript types from `types/database.ts`
8. **Soft Deletes**: Always use soft deletes (set `enabled = false`) instead of hard deletes
9. **Expo Router**: Use file-based routing in `app/` directory, not React Navigation
10. **Route Params**: Use `useLocalSearchParams()` to access route parameters, not `route.params`
11. **Navigation**: Use `router.push()`, `router.replace()`, or `router.back()` from `expo-router`
12. **Layout Files**: Every tab directory MUST have a `_layout.tsx` file for Expo Router to recognize routes
13. **Boolean Handling**: Always handle boolean fields that may be stored as integers (check for both `true` and `1`)
14. **Interfaces over Types**: Prefer TypeScript interfaces over types for better extensibility
15. **Avoid Enums**: Use maps/objects instead of enums for better tree-shaking and flexibility

## Adding New Entities

When adding a new entity type (e.g., "Sensors"), follow this checklist:

- [ ] Create service in `services/sensors.ts` following the service pattern
- [ ] Create form screen in `screens/Sensors/SensorFormScreen.tsx` following the form pattern
- [ ] Create list screen in `screens/Sensors/SensorListScreen.tsx`
- [ ] Create detail screen in `screens/Sensors/SensorDetailScreen.tsx`
- [ ] Add type definition in `types/database.ts`
- [ ] Add table definition in `lib/powersync.ts` schema
- [ ] Add query builder in `lib/powersync-queries.ts` if needed
- [ ] Add navigation routes in `app/(tabs)/{entity}/` directory structure
- [ ] Create `_layout.tsx` for stack navigation if needed
- [ ] Create `index.tsx` for list screen
- [ ] Create `new.tsx` for create form
- [ ] Create `[id].tsx` for detail screen
- [ ] Create `[id]/edit.tsx` for edit form
- [ ] Ensure all patterns match existing entities (Assets, Points, Gateways)
- [ ] Update navigation to use `router.push()` instead of `navigation.navigate()`
