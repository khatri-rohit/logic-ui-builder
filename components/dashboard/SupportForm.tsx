/* eslint-disable react/no-unescaped-entities */
import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useRef,
  useState,
} from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import logger from "@/lib/logger";
import {
  FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES,
  FEEDBACK_ATTACHMENT_ACCEPT,
  FEEDBACK_MAX_ATTACHMENTS,
  FEEDBACK_MAX_FILE_SIZE_BYTES,
  FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES,
  formatBytes,
} from "@/lib/feedback";

const allowedAttachmentTypeSet: ReadonlySet<string> = new Set(
  FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES,
);

interface SupportFormProps {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}

const SupportForm = ({ open, onOpenChange }: SupportFormProps) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const selectedTotalBytes = attachments.reduce(
    (sum, attachment) => sum + attachment.size,
    0,
  );

  const resetForm = () => {
    setMessage("");
    setAttachments([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      setAttachments([]);
      return;
    }

    if (selectedFiles.length > FEEDBACK_MAX_ATTACHMENTS) {
      toast.error(`You can upload up to ${FEEDBACK_MAX_ATTACHMENTS} files.`);
      event.target.value = "";
      return;
    }

    const unsupportedFile = selectedFiles.find(
      (file) => !allowedAttachmentTypeSet.has(file.type),
    );
    if (unsupportedFile) {
      toast.error("Only image and video files are supported.");
      event.target.value = "";
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > FEEDBACK_MAX_FILE_SIZE_BYTES,
    );
    if (oversizedFile) {
      toast.error(
        `Each file must be ${formatBytes(FEEDBACK_MAX_FILE_SIZE_BYTES)} or smaller.`,
      );
      event.target.value = "";
      return;
    }

    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
      toast.error(
        `Total attachments must be ${formatBytes(FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES)} or less.`,
      );
      event.target.value = "";
      return;
    }

    setAttachments(selectedFiles);
  };

  const sendSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      toast.error("Please describe your issue before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("feedback", trimmedMessage);
      payload.append("type", "support");
      for (const attachment of attachments) {
        payload.append("attachments", attachment);
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: payload,
      });

      const responseBody = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (response.ok && response.status === 200) {
        resetForm();
        onOpenChange(false);
        toast.success(
          "Support request received! We'll get back to you as soon as possible.",
          {
            duration: 3000,
          },
        );
        logger.info("Support submission response:", {
          status: response.status,
          attachments: attachments.length,
        });
        return;
      }

      toast.error(
        responseBody?.message ??
          responseBody?.error ??
          "We couldn't send your support request. Please check your connection and try again.",
        {
          duration: 4000,
        },
      );
      logger.error("Failed to send support request:", {
        status: response.status,
        responseBody,
      });
    } catch (error) {
      logger.error("Error sending support request:", { error });
      toast.error("Something went wrong. Please try again in a moment.", {
        duration: 4000,
      });
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="dark bg-background border-l border-border shadow-2xl rounded-none w-full sm:max-w-md h-full mt-0">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-foreground text-xl">
            Support & Help
          </DrawerTitle>
          <DrawerDescription className="text-muted-foreground mt-2">
            Need help with something? Describe your issue below and we'll get
            back to you as soon as possible. Screenshots and screen recordings
            are especially helpful.
          </DrawerDescription>
        </DrawerHeader>
        <form className="grid gap-4 px-4 py-4" onSubmit={sendSupport}>
          <label
            htmlFor="support-message"
            className="text-sm font-medium leading-5 text-foreground"
          >
            Describe your issue{" "}
            <span className="text-muted-foreground">(required)</span>
          </label>
          <Textarea
            id="support-message"
            rows={6}
            placeholder="Tell us what's going wrong or what you need help with..."
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <Field className="pt-4">
            <FieldLabel htmlFor="support-attachments" className="text-foreground">
              Attachments
            </FieldLabel>
            <Input
              id="support-attachments"
              ref={attachmentInputRef}
              type="file"
              multiple
              accept={FEEDBACK_ATTACHMENT_ACCEPT}
              onChange={handleAttachmentChange}
              className="border-border bg-card text-foreground file:text-foreground"
            />
            <FieldDescription className="text-muted-foreground">
              Upload up to {FEEDBACK_MAX_ATTACHMENTS} files. Each file can be up
              to {formatBytes(FEEDBACK_MAX_FILE_SIZE_BYTES)} and total
              attachments can be up to
              {" " + formatBytes(FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.
            </FieldDescription>
            {attachments.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {attachments.length} file(s) selected (
                {formatBytes(selectedTotalBytes)})
              </p>
            ) : null}
          </Field>
          <DrawerFooter className="pt-2 px-0">
            <Button
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium shadow-none h-11 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Support Request"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
};

export default SupportForm;
