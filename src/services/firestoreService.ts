import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot,
    QueryConstraint,
    serverTimestamp,
    Timestamp,
    addDoc,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface FirestoreDocument {
    id: string;
    created_at?: Timestamp;
    updated_at?: Timestamp;
    [key: string]: any;
}

class FirestoreService {
    /**
     * Get a single document by ID
     */
    async getDocument<T extends FirestoreDocument>(
        collectionName: string,
        documentId: string
    ): Promise<T | null> {
        try {
            const docRef = doc(db, collectionName, documentId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            return {
                id: docSnap.id,
                ...docSnap.data(),
            } as T;
        } catch (error: any) {
            logger.error(`Error getting document from ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to get document');
        }
    }

    /**
     * Get multiple documents with query
     */
    async getDocuments<T extends FirestoreDocument>(
        collectionName: string,
        constraints: QueryConstraint[] = []
    ): Promise<T[]> {
        try {
            const q = query(collection(db, collectionName), ...constraints);
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as T[];
        } catch (error: any) {
            logger.error(`Error getting documents from ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to get documents');
        }
    }

    /**
     * Create a new document
     */
    async createDocument<T extends Partial<FirestoreDocument>>(
        collectionName: string,
        data: T,
        customId?: string
    ): Promise<string> {
        try {
            const docData = {
                ...data,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            };

            if (customId) {
                await setDoc(doc(db, collectionName, customId), docData);
                logger.info(`Document created in ${collectionName} with ID:`, customId);
                return customId;
            } else {
                const docRef = await addDoc(collection(db, collectionName), docData);
                logger.info(`Document created in ${collectionName} with ID:`, docRef.id);
                return docRef.id;
            }
        } catch (error: any) {
            logger.error(`Error creating document in ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to create document');
        }
    }

    /**
     * Update an existing document
     */
    async updateDocument<T extends Partial<FirestoreDocument>>(
        collectionName: string,
        documentId: string,
        data: T
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, documentId);
            await updateDoc(docRef, {
                ...data,
                updated_at: serverTimestamp(),
            });

            logger.info(`Document updated in ${collectionName}:`, documentId);
        } catch (error: any) {
            logger.error(`Error updating document in ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to update document');
        }
    }

    /**
     * Delete a document
     */
    async deleteDocument(collectionName: string, documentId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, collectionName, documentId));
            logger.info(`Document deleted from ${collectionName}:`, documentId);
        } catch (error: any) {
            logger.error(`Error deleting document from ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to delete document');
        }
    }

    /**
     * Batch write operations
     */
    async batchWrite(operations: Array<{
        type: 'create' | 'update' | 'delete';
        collection: string;
        id?: string;
        data?: any;
    }>): Promise<void> {
        try {
            const batch = writeBatch(db);

            operations.forEach(op => {
                const docRef = op.id
                    ? doc(db, op.collection, op.id)
                    : doc(collection(db, op.collection));

                switch (op.type) {
                    case 'create':
                        batch.set(docRef, {
                            ...op.data,
                            created_at: serverTimestamp(),
                            updated_at: serverTimestamp(),
                        });
                        break;
                    case 'update':
                        batch.update(docRef, {
                            ...op.data,
                            updated_at: serverTimestamp(),
                        });
                        break;
                    case 'delete':
                        batch.delete(docRef);
                        break;
                }
            });

            await batch.commit();
            logger.info('Batch write completed successfully');
        } catch (error: any) {
            logger.error('Error in batch write:', error);
            throw new Error(error.message || 'Failed to execute batch write');
        }
    }

    /**
     * Query with pagination
     */
    async queryWithPagination<T extends FirestoreDocument>(
        collectionName: string,
        constraints: QueryConstraint[],
        pageSize: number,
        lastDoc?: DocumentSnapshot
    ): Promise<{ documents: T[]; lastDocument: DocumentSnapshot | null }> {
        try {
            const queryConstraints = [...constraints, limit(pageSize)];

            if (lastDoc) {
                queryConstraints.push(startAfter(lastDoc));
            }

            const q = query(collection(db, collectionName), ...queryConstraints);
            const querySnapshot = await getDocs(q);

            const documents = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as T[];

            const lastDocument = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

            return { documents, lastDocument };
        } catch (error: any) {
            logger.error(`Error querying ${collectionName} with pagination:`, error);
            throw new Error(error.message || 'Failed to query with pagination');
        }
    }

    /**
     * Count documents matching query
     */
    async countDocuments(
        collectionName: string,
        constraints: QueryConstraint[] = []
    ): Promise<number> {
        try {
            const q = query(collection(db, collectionName), ...constraints);
            const querySnapshot = await getDocs(q);
            return querySnapshot.size;
        } catch (error: any) {
            logger.error(`Error counting documents in ${collectionName}:`, error);
            throw new Error(error.message || 'Failed to count documents');
        }
    }
}

export const firestoreService = new FirestoreService();
export { where, orderBy, limit };
