// ============================================================
// services/parentChildService.js
// Manages child profiles under a parent user account.
//
// Frontend alignment (types/domain/user.ts — Child interface):
//   - Child.sportInterests: string[]  (array of sport slugs, not single sport)
//   - Child.gender: 'male' | 'female' | 'other' | 'prefer_not_to_say'  (optional)
//   - Child.age: number  (not dob — matches frontend use-children.ts)
//   - Child.parentId: string
//
// Frontend hook: lib/hooks/use-children.ts
//   addChild:    { name, age, sport (single), skillLevel? }  → stored as sportInterests[]
//   updateChild: Partial<{ name, age, sport, skillLevel }>
//   removeChild: by id
//   setActiveChild: by id
//
// Profile page: app/(private)/profile/children/page.tsx
// ============================================================

const Child = require('../models/Child');

// ─── ADD CHILD ───────────────────────────────────────────────
// Parent adds a child profile.
// sportInterests is an array of sport slugs (e.g. ['cricket', 'football']).
// The frontend use-children hook may pass a single 'sport' string — normalised to array here.
const addChild = async (parentId, childData) => {
  const {
    name,
    age,
    gender,
    sportInterests, // array of sport slugs — preferred
    sport,          // single sport string from use-children hook — fallback
    skillLevel,
    medicalNotes,
  } = childData;

  // Normalise: prefer sportInterests[], fall back to [sport] for backward compat
  const interests = Array.isArray(sportInterests) && sportInterests.length
    ? sportInterests
    : sport ? [sport] : [];

  return Child.create({
    parentId,
    name,
    age,
    gender:         gender || null,
    sportInterests: interests,
    skillLevel:     skillLevel || null,
    medicalNotes:   medicalNotes || null,
    isActive:       true,
  });
};

// ─── UPDATE CHILD ────────────────────────────────────────────
// Edit child's details.
// Normalises sport → sportInterests[] same as addChild.
const updateChild = async (childId, updates) => {
  if (updates.sport && !updates.sportInterests) {
    // Convert single sport string to array for consistent storage
    updates.sportInterests = [updates.sport];
    delete updates.sport;
  }

  const child = await Child.findByIdAndUpdate(childId, updates, { new: true });
  if (!child) throw new Error('Child not found');
  return child;
};

// ─── DELETE CHILD ────────────────────────────────────────────
const deleteChild = async (childId) => {
  const child = await Child.findByIdAndDelete(childId);
  if (!child) throw new Error('Child not found');
  return { message: 'Child removed' };
};

// ─── SET ACTIVE CHILD ────────────────────────────────────────
// Sets one child as the currently active/selected profile.
// Deactivates ALL children for this parent first, then activates the chosen one.
// Matches setActiveChild() in use-children.ts hook.
const setActiveChild = async (parentId, childId) => {
  await Child.updateMany({ parentId }, { isActive: false });
  const child = await Child.findByIdAndUpdate(childId, { isActive: true }, { new: true });
  if (!child) throw new Error('Child not found');
  return { message: 'Active child updated', activeChild: child };
};

// ─── GET CHILDREN BY PARENT ──────────────────────────────────
// Returns all children linked to a parent, sorted by creation order (oldest first).
// Matches the hydration in use-children.ts useEffect.
const getChildrenByParent = async (parentId) => {
  return Child.find({ parentId }).sort({ createdAt: 1 });
};

// ─── GET ACTIVE CHILD ────────────────────────────────────────
// Returns the currently active child for a parent.
const getActiveChild = async (parentId) => {
  const child = await Child.findOne({ parentId, isActive: true });
  return child || null;
};

module.exports = {
  addChild,
  updateChild,
  deleteChild,
  setActiveChild,
  getChildrenByParent,
  getActiveChild,
};
