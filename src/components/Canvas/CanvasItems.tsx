import React, { useMemo } from 'react';
import { Layer } from 'react-konva';
import { EnterpriseNote } from '../Note/EnterpriseNote';
import { CanvasImage } from './CanvasImage';
import { CanvasFile } from './CanvasFile';
import { Note, CanvasImage as ICanvasImage, CanvasFile as ICanvasFile } from '../../types';

interface VisibleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface CanvasItemsProps {
  notes: Note[];
  images: ICanvasImage[];
  files: ICanvasFile[];
  editingNoteId: string | null;
  selectedNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  selectImage: (id: string | null) => void;
  selectFile: (id: string | null) => void;
  setEditingNoteId: (id: string | null) => void;
  setIsAnyNoteResizing: (isResizing: boolean) => void;
  setIsAnyNoteDragging: (isDragging: boolean) => void;
  visibleRect?: VisibleRect | null;
}

export const CanvasItems = React.memo(function CanvasItems({
  notes,
  images,
  files,
  editingNoteId,
  selectedNoteId,
  selectedImageId,
  selectedFileId,
  selectImage,
  selectFile,
  setEditingNoteId,
  setIsAnyNoteResizing,
  setIsAnyNoteDragging,
  visibleRect = null,
}: CanvasItemsProps) {
  const isInView = useMemo(() => {
    if (!visibleRect) return () => true;
    return (x: number, y: number, width: number, height: number) => {
      const right = x + width;
      const bottom = y + height;
      return (
        x < visibleRect.right &&
        right > visibleRect.left &&
        y < visibleRect.bottom &&
        bottom > visibleRect.top
      );
    };
  }, [visibleRect]);

  const visibleImages = useMemo(() => {
    if (!visibleRect) return images;
    return images.filter((img) => img.id === selectedImageId || isInView(img.x, img.y, img.width, img.height));
  }, [images, selectedImageId, visibleRect, isInView]);

  const visibleFiles = useMemo(() => {
    if (!visibleRect) return files;
    return files.filter((f) => f.id === selectedFileId || isInView(f.x, f.y, f.width, f.height));
  }, [files, selectedFileId, visibleRect, isInView]);

  // Sort only what we render (reduces cost when many offscreen notes exist).
  const visibleNotes = useMemo(() => {
    if (!visibleRect) return [...notes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const filtered = notes.filter(
      (n) =>
        n.id === selectedNoteId ||
        n.id === editingNoteId ||
        isInView(n.x, n.y, n.width, n.height)
    );
    return filtered.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [notes, selectedNoteId, editingNoteId, visibleRect, isInView]);

  return (
    <Layer>
      {/* Render images */}
      {visibleImages.map((image) => (
        <CanvasImage
          key={image.id}
          image={image}
          isSelected={selectedImageId === image.id}
          onSelect={() => selectImage(image.id)}
          onResizingChange={(isResizing) => {
            setIsAnyNoteResizing(isResizing);
          }}
          onDraggingChange={(isDragging) => {
            setIsAnyNoteDragging(isDragging);
          }}
        />
      ))}

      {/* Render files */}
      {visibleFiles.map((file) => (
        <CanvasFile
          key={file.id}
          file={file}
          isSelected={selectedFileId === file.id}
          onSelect={() => selectFile(file.id)}
          onDraggingChange={(isDragging) => {
            setIsAnyNoteDragging(isDragging);
          }}
        />
      ))}

      {/* Render notes sorted by zIndex */}
      {visibleNotes.map((note) => (
        <EnterpriseNote
          key={note.id}
          note={note}
          isEditing={editingNoteId === note.id}
          onStartEditing={() => setEditingNoteId(note.id)}
          onResizingChange={(isResizing) => {
            setIsAnyNoteResizing(isResizing);
          }}
          onDraggingChange={(isDragging) => {
            setIsAnyNoteDragging(isDragging);
          }}
        />
      ))}
    </Layer>
  );
});
