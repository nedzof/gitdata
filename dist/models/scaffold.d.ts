import type { Router } from 'express';
export declare function runModelsMigrations(db?: Database.Database): Promise<void>;
export declare function modelsRouter(db: Database.Database): Router;
