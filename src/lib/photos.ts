import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "@/lib/supabase";
import { makeId } from "@/utils/ids";

// ---------------------------------------------------------------------------
// Recipe photos: picking one, shrinking it, uploading it to Supabase Storage,
// and turning a stored path back into a link. See supabase/14_recipe_photos.sql.
// ---------------------------------------------------------------------------

const BUCKET = "recipe-photos";
// avatars: see supabase/27_avatars_and_social.sql; household-photos: 28_household_photos.sql
export type PhotoBucket = "recipe-photos" | "avatars" | "household-photos";
const SETUP_FILE: Record<PhotoBucket, string> = {
  "recipe-photos": "14_recipe_photos.sql",
  avatars: "27_avatars_and_social.sql",
  "household-photos": "28_household_photos.sql",
};
const MAX_WIDTH = 1200; // plenty for a phone screen, and keeps files ~150–300 KB

// A picked photo, shrunk and ready to upload. `uri` shows it straight away.
export type PickedPhoto = { uri: string; base64: string };

// Opens the camera or the photo library. null if cancelled or not allowed.
// Returns a string instead when something went wrong, to show the person.
//   shape: "recipe" crops to 4:3 like recipe covers, "square" for profile pictures
export async function pickPhoto(
  from: "camera" | "library",
  shape: "recipe" | "square" = "recipe",
): Promise<PickedPhoto | null | string> {
  if (from === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted)
      return "PantryGo needs camera access to take a photo. You can allow it in your phone's settings.";
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true, // let them crop it
    aspect: shape === "square" ? [1, 1] : [4, 3], // recipe covers are 4:3
    quality: 1, // we compress it ourselves below
  };
  const result =
    from === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const maxWidth = shape === "square" ? 512 : MAX_WIDTH; // a profile picture is shown small
    if (asset.width > maxWidth) context.resize({ width: maxWidth });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!saved.base64) return "Couldn't read that photo. Try another one.";
    return { uri: saved.uri, base64: saved.base64 };
  } catch {
    return "Couldn't read that photo. Try another one.";
  }
}

// Uploads into your own folder ("<your id>/<random>.jpg") and returns the path
// to save on the recipe, or throws with a message.
export async function uploadPhoto(
  photo: PickedPhoto,
  folder: string, // your id, or for a household picture the household's id
  bucket: PhotoBucket = BUCKET,
): Promise<string> {
  const path = `${folder}/${makeId()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, base64ToBytes(photo.base64), { contentType: "image/jpeg" });
  if (error) {
    throw new Error(
      error.message.includes("not found")
        ? `Photos aren't set up yet. Run supabase/${SETUP_FILE[bucket]} in Supabase.`
        : `Couldn't upload the photo: ${error.message}`,
    );
  }
  return path;
}

// Old photos aren't deleted when you change one: someone may have saved a copy
// of your shared recipe, and their copy still shows your photo.

// A stored path → a link the app can show. Picked-but-not-uploaded photos are
// already local files, so they pass straight through.
export function photoUrl(photo: string | null, bucket: PhotoBucket = BUCKET): string | null {
  if (!photo) return null;
  if (/^(file|content|ph|https?):/.test(photo)) return photo; // e.g. a Google profile photo
  return supabase.storage.from(bucket).getPublicUrl(photo).data.publicUrl;
}

// "SGVsbG8=" → the raw bytes (the upload wants bytes, the manipulator gives text)
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
