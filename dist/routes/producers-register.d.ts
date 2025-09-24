import type { Router } from 'express';
/**
 * POST /producers/register { name?, website? }
 * Requires identity signature; associates identity key with producer profile.
 */
export declare function producersRegisterRouter(): Router;
