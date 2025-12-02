/**
 * Supabase Compatibility Layer
 * 
 * This file provides a compatibility layer to map Supabase API calls to Firebase.
 * This is a temporary solution to prevent breaking changes while migrating.
 * 
 * TODO: Remove this file once all code is migrated to use Firebase directly.
 */

import { firestoreService, where, orderBy, limit } from '../services/firestoreService';
import { authService } from '../services/firebaseAuthService';
import { storageService } from '../services/firebaseStorageService';
import { logger } from './logger';

interface QueryBuilder {
    select: (columns: string) => QueryBuilder;
    eq: (column: string, value: any) => QueryBuilder;
    neq: (column: string, value: any) => QueryBuilder;
    gt: (column: string, value: any) => QueryBuilder;
    gte: (column: string, value: any) => QueryBuilder;
    lt: (column: string, value: any) => QueryBuilder;
    lte: (column: string, value: any) => QueryBuilder;
    like: (column: string, pattern: string) => QueryBuilder;
    ilike: (column: string, pattern: string) => QueryBuilder;
    in: (column: string, values: any[]) => QueryBuilder;
    order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
    limit: (count: number) => QueryBuilder;
    single: () => Promise<{ data: any; error: any }>;
    maybeSingle: () => Promise<{ data: any; error: any }>;
    then: (resolve: (value: { data: any; error: any }) => void) => Promise<any>;
}

class SupabaseCompatibility {
    private tableName: string = '';
    private filters: any[] = [];
    private orderByClause: any[] = [];
    private limitCount: number | null = null;
    private selectColumns: string = '*';

    from(table: string): QueryBuilder {
        this.tableName = table;
        this.filters = [];
        this.orderByClause = [];
        this.limitCount = null;
        this.selectColumns = '*';

        const builder: QueryBuilder = {
            select: (columns: string) => {
                this.selectColumns = columns;
                return builder;
            },
            eq: (column: string, value: any) => {
                this.filters.push(where(column, '==', value));
                return builder;
            },
            neq: (column: string, value: any) => {
                this.filters.push(where(column, '!=', value));
                return builder;
            },
            gt: (column: string, value: any) => {
                this.filters.push(where(column, '>', value));
                return builder;
            },
            gte: (column: string, value: any) => {
                this.filters.push(where(column, '>=', value));
                return builder;
            },
            lt: (column: string, value: any) => {
                this.filters.push(where(column, '<', value));
                return builder;
            },
            lte: (column: string, value: any) => {
                this.filters.push(where(column, '<=', value));
                return builder;
            },
            like: (column: string, pattern: string) => {
                logger.warn('LIKE queries are not directly supported in Firestore. Consider using full-text search.');
                return builder;
            },
            ilike: (column: string, pattern: string) => {
                logger.warn('ILIKE queries are not directly supported in Firestore. Consider using full-text search.');
                return builder;
            },
            in: (column: string, values: any[]) => {
                this.filters.push(where(column, 'in', values));
                return builder;
            },
            order: (column: string, options?: { ascending?: boolean }) => {
                const direction = options?.ascending === false ? 'desc' : 'asc';
                this.orderByClause.push(orderBy(column, direction));
                return builder;
            },
            limit: (count: number) => {
                this.limitCount = count;
                return builder;
            },
            single: async () => {
                try {
                    const constraints = [...this.filters, ...this.orderByClause];
                    if (this.limitCount) constraints.push(limit(1));

                    const results = await firestoreService.getDocuments(this.tableName, constraints);

                    if (results.length === 0) {
                        return { data: null, error: new Error('No rows found') };
                    }

                    return { data: results[0], error: null };
                } catch (error) {
                    logger.error('Error in single query:', error);
                    return { data: null, error };
                }
            },
            maybeSingle: async () => {
                try {
                    const constraints = [...this.filters, ...this.orderByClause];
                    if (this.limitCount) constraints.push(limit(1));

                    const results = await firestoreService.getDocuments(this.tableName, constraints);

                    return { data: results[0] || null, error: null };
                } catch (error) {
                    logger.error('Error in maybeSingle query:', error);
                    return { data: null, error };
                }
            },
            then: async (resolve) => {
                try {
                    const constraints = [...this.filters, ...this.orderByClause];
                    if (this.limitCount) constraints.push(limit(this.limitCount));

                    const results = await firestoreService.getDocuments(this.tableName, constraints);

                    return resolve({ data: results, error: null });
                } catch (error) {
                    logger.error('Error in query:', error);
                    return resolve({ data: null, error });
                }
            }
        };

        return builder;
    }

    // Auth compatibility
    auth = {
        signUp: async (credentials: { email: string; password: string; options?: any }) => {
            try {
                const { user } = await authService.signUp(
                    credentials.email,
                    credentials.password,
                    {
                        full_name: credentials.options?.data?.full_name || '',
                        role: credentials.options?.data?.role || 'buyer',
                        phone: credentials.options?.data?.phone,
                    }
                );
                return { data: { user }, error: null };
            } catch (error) {
                return { data: null, error };
            }
        },
        signInWithPassword: async (credentials: { email: string; password: string }) => {
            try {
                const { user } = await authService.signIn(credentials.email, credentials.password);
                return { data: { user }, error: null };
            } catch (error) {
                return { data: null, error };
            }
        },
        signOut: async () => {
            try {
                await authService.signOut();
                return { error: null };
            } catch (error) {
                return { error };
            }
        },
        getUser: async () => {
            try {
                const user = authService.getCurrentUser();
                return { data: { user }, error: null };
            } catch (error) {
                return { data: null, error };
            }
        },
        onAuthStateChange: (callback: (event: string, session: any) => void) => {
            return authService.onAuthStateChange((user) => {
                callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', { user });
            });
        }
    };

    // Storage compatibility
    storage = {
        from: (bucket: string) => ({
            upload: async (path: string, file: File, options?: any) => {
                try {
                    const fullPath = `${bucket}/${path}`;
                    const url = await storageService.uploadFile(file, fullPath);
                    return { data: { path: fullPath, url }, error: null };
                } catch (error) {
                    return { data: null, error };
                }
            },
            getPublicUrl: (path: string) => {
                return { data: { publicUrl: path } };
            },
            remove: async (paths: string[]) => {
                try {
                    await storageService.deleteMultipleFiles(paths);
                    return { data: null, error: null };
                } catch (error) {
                    return { data: null, error };
                }
            }
        })
    };
}

// Create and export a singleton instance
export const supabase = new SupabaseCompatibility();

// Log warning about compatibility layer
logger.warn('⚠️ Using Supabase compatibility layer. Please migrate to Firebase services directly.');
