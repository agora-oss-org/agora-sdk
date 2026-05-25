# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building
- `pnpm run build-all` - Builds all packages in the monorepo in dependency order
- Individual package builds: `pnpm --filter @replyke/[package-name] run build`
- Each package builds to ESM and CJS formats using TypeScript

### Publishing
- `pnpm run publish-prod` - Publishes all packages to production
- `pnpm run publish-beta` - Publishes all packages with beta tag
- Releases are cut with `pnpm run patch` / `minor` / `major` (bump → commit → tag → push); pushing the `v*` tag triggers the publish workflow.

## Changelog

This repo keeps a [`CHANGELOG.md`](CHANGELOG.md) in [Keep a Changelog](https://keepachangelog.com/) format.

**You MUST keep it current.** After making any code, config, or build change, add a
bullet under the `## [Unreleased]` section (in the appropriate `Added` / `Changed` /
`Fixed` / `Removed` group) describing the change in the same commit. When a release is
cut, the `[Unreleased]` entries are renamed to the new version and a fresh empty
`[Unreleased]` section is started.

## Architecture Overview

This is a **monorepo** for Replyke, an open-source social features framework. The project uses pnpm workspaces and follows a layered architecture:

### Core Architecture Layers

1. **API Foundation** - All functionality is accessible through REST APIs
2. **Libraries & SDKs** - TypeScript libraries that wrap the API with hooks and utilities
3. **UI Components** - Ready-to-use React/React Native components built on the libraries

### Package Structure

The monorepo is organized into these main packages:

- **`@replyke/core`** - Core hooks, context providers, and utilities for both React and React Native
- **`@replyke/react-js`** - React-specific implementations and re-exports from core
- **`@replyke/react-native`** - React Native-specific implementations with token management
- **`@replyke/expo`** - Expo-specific implementations with secure token storage

#### UI Packages
- **`@replyke/ui-core`** - Shared UI utilities and interfaces
- **`@replyke/ui-core-react-js`** - React-specific UI components (avatars, skeletons, icons)
- **`@replyke/ui-core-react-native`** - React Native-specific UI components

#### Comments System
- **`@replyke/comments-social-core`** - Core styling and configuration for social comments
- **`@replyke/comments-social-react-js`** - Complete React comment system with modals
- **`@replyke/comments-social-react-native`** - Complete React Native comment system with sheets

### Key Context Providers

The framework uses React Context for state management:
- `ReplykeProvider` - Root provider with project configuration
- `EntityProvider` - Manages individual entities (posts, articles, etc.)
- `EntityListProvider` - Manages collections of entities with filtering/sorting
- `CommentSectionProvider` - Manages comment threads and interactions
- `AuthProvider` - Handles authentication state
- `ListsProvider` - Manages user-created lists and collections

### Development Patterns

- **Workspace Dependencies**: Packages use `workspace:*` for internal dependencies
- **Build Process**: Each package compiles to both ESM (`dist/esm`) and CJS (`dist/cjs`) formats
- **TypeScript**: All packages use TypeScript with separate configs for ESM/CJS builds
- **Context-Hook Pattern**: UI components get state through context providers and custom hooks
- **Platform Abstraction**: Shared core logic with platform-specific implementations

### Usage Flow

1. Wrap app in `ReplykeProvider` with project ID and authentication token
2. Use `EntityProvider` to define the content being discussed
3. Add social components like `SocialCommentSection` which self-contain all UI and logic
4. Components automatically handle API calls, state management, and real-time updates

All social features (comments, votes, follows, lists, notifications) follow this same provider + hooks + components pattern.