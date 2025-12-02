import {
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll,
    UploadTask,
    UploadMetadata,
} from 'firebase/storage';
import { storage } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface UploadProgress {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
}

class StorageService {
    /**
     * Upload a file to Firebase Storage
     */
    async uploadFile(
        file: File,
        path: string,
        metadata?: UploadMetadata,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string> {
        try {
            const storageRef = ref(storage, path);

            if (onProgress) {
                // Upload with progress tracking
                const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, metadata);

                return new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const progress: UploadProgress = {
                                bytesTransferred: snapshot.bytesTransferred,
                                totalBytes: snapshot.totalBytes,
                                percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
                            };
                            onProgress(progress);
                        },
                        (error) => {
                            logger.error('Error uploading file:', error);
                            reject(error);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            logger.info('File uploaded successfully:', path);
                            resolve(downloadURL);
                        }
                    );
                });
            } else {
                // Simple upload without progress
                await uploadBytes(storageRef, file, metadata);
                const downloadURL = await getDownloadURL(storageRef);
                logger.info('File uploaded successfully:', path);
                return downloadURL;
            }
        } catch (error: any) {
            logger.error('Error uploading file:', error);
            throw new Error(error.message || 'Failed to upload file');
        }
    }

    /**
     * Upload multiple files
     */
    async uploadMultipleFiles(
        files: File[],
        basePath: string,
        onProgress?: (fileIndex: number, progress: UploadProgress) => void
    ): Promise<string[]> {
        try {
            const uploadPromises = files.map((file, index) => {
                const filePath = `${basePath}/${Date.now()}_${file.name}`;
                return this.uploadFile(
                    file,
                    filePath,
                    undefined,
                    onProgress ? (progress) => onProgress(index, progress) : undefined
                );
            });

            const downloadURLs = await Promise.all(uploadPromises);
            logger.info(`${files.length} files uploaded successfully`);
            return downloadURLs;
        } catch (error: any) {
            logger.error('Error uploading multiple files:', error);
            throw new Error(error.message || 'Failed to upload files');
        }
    }

    /**
     * Delete a file from Firebase Storage
     */
    async deleteFile(path: string): Promise<void> {
        try {
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
            logger.info('File deleted successfully:', path);
        } catch (error: any) {
            logger.error('Error deleting file:', error);
            throw new Error(error.message || 'Failed to delete file');
        }
    }

    /**
     * Delete multiple files
     */
    async deleteMultipleFiles(paths: string[]): Promise<void> {
        try {
            const deletePromises = paths.map(path => this.deleteFile(path));
            await Promise.all(deletePromises);
            logger.info(`${paths.length} files deleted successfully`);
        } catch (error: any) {
            logger.error('Error deleting multiple files:', error);
            throw new Error(error.message || 'Failed to delete files');
        }
    }

    /**
     * Get download URL for a file
     */
    async getFileURL(path: string): Promise<string> {
        try {
            const storageRef = ref(storage, path);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error: any) {
            logger.error('Error getting file URL:', error);
            throw new Error(error.message || 'Failed to get file URL');
        }
    }

    /**
     * List all files in a directory
     */
    async listFiles(path: string): Promise<string[]> {
        try {
            const storageRef = ref(storage, path);
            const result = await listAll(storageRef);

            const urls = await Promise.all(
                result.items.map(item => getDownloadURL(item))
            );

            return urls;
        } catch (error: any) {
            logger.error('Error listing files:', error);
            throw new Error(error.message || 'Failed to list files');
        }
    }

    /**
     * Upload image with automatic resizing metadata
     */
    async uploadImage(
        file: File,
        path: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string> {
        try {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                throw new Error('File must be an image');
            }

            const metadata: UploadMetadata = {
                contentType: file.type,
                customMetadata: {
                    uploadedAt: new Date().toISOString(),
                },
            };

            return await this.uploadFile(file, path, metadata, onProgress);
        } catch (error: any) {
            logger.error('Error uploading image:', error);
            throw new Error(error.message || 'Failed to upload image');
        }
    }

    /**
     * Generate unique file path
     */
    generateFilePath(folder: string, fileName: string): string {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.replace(`.${extension}`, '');

        return `${folder}/${timestamp}_${randomString}_${nameWithoutExt}.${extension}`;
    }
}

export const storageService = new StorageService();
