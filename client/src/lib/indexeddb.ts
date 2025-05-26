import { Meeting, ActionItem, Participant } from './types';

class IndexedDBStorage {
  private dbName = 'SmartMinutesMakerDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create meetings store
        if (!db.objectStoreNames.contains('meetings')) {
          const meetingStore = db.createObjectStore('meetings', { keyPath: 'id', autoIncrement: true });
          meetingStore.createIndex('title', 'title', { unique: false });
          meetingStore.createIndex('date', 'date', { unique: false });
          meetingStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Create email templates store
        if (!db.objectStoreNames.contains('emailTemplates')) {
          const templateStore = db.createObjectStore('emailTemplates', { keyPath: 'id', autoIncrement: true });
          templateStore.createIndex('name', 'name', { unique: false });
          templateStore.createIndex('type', 'type', { unique: false });
        }

        // Create user preferences store
        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'key' });
        }
      };
    });
  }

  // Meeting CRUD operations
  async saveMeeting(meeting: Omit<Meeting, 'id'>): Promise<Meeting> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.add(meeting);

      request.onsuccess = () => {
        const newMeeting = { ...meeting, id: request.result as number };
        resolve(newMeeting);
      };

      request.onerror = () => {
        reject(new Error('Failed to save meeting'));
      };
    });
  }

  async updateMeeting(id: number, updates: Partial<Meeting>): Promise<Meeting> {
    if (!this.db) await this.init();
    
    const existing = await this.getMeeting(id);
    if (!existing) {
      throw new Error('Meeting not found');
    }

    const updated = { ...existing, ...updates };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.put(updated);

      request.onsuccess = () => {
        resolve(updated);
      };

      request.onerror = () => {
        reject(new Error('Failed to update meeting'));
      };
    });
  }

  async getMeeting(id: number): Promise<Meeting | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get meeting'));
      };
    });
  }

  async getAllMeetings(): Promise<Meeting[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['meetings'], 'readonly');
      const store = transaction.objectStore('meetings');
      const request = store.getAll();

      request.onsuccess = () => {
        const meetings = request.result.sort((a: Meeting, b: Meeting) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        resolve(meetings);
      };

      request.onerror = () => {
        reject(new Error('Failed to get meetings'));
      };
    });
  }

  async deleteMeeting(id: number): Promise<boolean> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['meetings'], 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete meeting'));
      };
    });
  }

  async searchMeetings(query: string): Promise<Meeting[]> {
    const allMeetings = await this.getAllMeetings();
    const lowerQuery = query.toLowerCase();
    
    return allMeetings.filter(meeting =>
      meeting.title.toLowerCase().includes(lowerQuery) ||
      (meeting.transcript && meeting.transcript.toLowerCase().includes(lowerQuery)) ||
      (meeting.summary && meeting.summary.toLowerCase().includes(lowerQuery)) ||
      (meeting.tags && meeting.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  async getMeetingsByTag(tag: string): Promise<Meeting[]> {
    const allMeetings = await this.getAllMeetings();
    return allMeetings.filter(meeting => 
      meeting.tags && meeting.tags.includes(tag)
    );
  }

  // Email template operations
  async saveEmailTemplate(template: {
    name: string;
    type: 'summary' | 'action_items' | 'full_report';
    subject: string;
    body: string;
    variables: string[];
  }): Promise<any> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['emailTemplates'], 'readwrite');
      const store = transaction.objectStore('emailTemplates');
      const request = store.add(template);

      request.onsuccess = () => {
        resolve({ ...template, id: request.result });
      };

      request.onerror = () => {
        reject(new Error('Failed to save email template'));
      };
    });
  }

  async getEmailTemplates(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['emailTemplates'], 'readonly');
      const store = transaction.objectStore('emailTemplates');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get email templates'));
      };
    });
  }

  // User preferences operations
  async savePreference(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPreferences'], 'readwrite');
      const store = transaction.objectStore('userPreferences');
      const request = store.put({ key, value });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save preference'));
      };
    });
  }

  async getPreference(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPreferences'], 'readonly');
      const store = transaction.objectStore('userPreferences');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get preference'));
      };
    });
  }
}

export const indexedDBStorage = new IndexedDBStorage();