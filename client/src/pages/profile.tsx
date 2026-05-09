import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/context/LanguageContext";
import { useTranslation } from "react-i18next";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Camera, Lock, User as UserIcon, Moon, Sun, Mail, CheckCircle, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";
import { AvatarPreviewModal } from "@/components/avatar-preview-modal";


export default function Profile() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username || "");
  const [pin, setPin] = useState("");
  const [baseAvatarUrl, setBaseAvatarUrl] = useState(user?.avatarUrl || "");
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState(user?.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : "");
  const [gender, setGender] = useState((user?.gender as any) || "other");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [previewImageData, setPreviewImageData] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Email change modal states
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState<0 | 1 | 2 | 3>(0); // Step 0: confirm, Step 1: verify old email, Step 2: new email, Step 3: verify new email
  const [identityVerificationCode, setIdentityVerificationCode] = useState("");
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState(false);
  const [isSendingVerificationCode, setIsSendingVerificationCode] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [newEmailVerificationCode, setNewEmailVerificationCode] = useState("");
  const [isSubmittingNewEmail, setIsSubmittingNewEmail] = useState(false);
  const [isVerifyingNewEmail, setIsVerifyingNewEmail] = useState(false);
  
  // PIN change modal states
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmNewPinInput, setConfirmNewPinInput] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false);

  // Debounce timer for auto-save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect component mount - run ONCE on every mount
  useEffect(() => {
    console.log('[Profile] Component mounted successfully, user:', user);
    return () => console.log('[Profile] Component unmounting');
  }, []);

  // Sync state when user changes - IMPORTANT for consistency after refresh/HMR
  useEffect(() => {
    if (user?.id && user?.username) {
      console.log('[Profile] Syncing user state:', { id: user.id, username: user.username });
      setUsername(user.username || "");
      setBaseAvatarUrl(user.avatarUrl || "");
      // Use server proxy URL for cross-device compatibility
      const proxyUrl = user.id ? `/api/avatars/${user.id}?t=${Date.now()}` : "";
      setDisplayAvatarUrl(proxyUrl);
      setGender((user.gender as any) || "other");
    }
  }, [user?.id]); // Only resync when user ID changes

  // Sync avatar URL when user updates, with cache-busting
  useEffect(() => {
    if (user?.avatarUrl && user?.id) {
      setBaseAvatarUrl(user.avatarUrl);
      // Use server proxy URL for cross-device compatibility
      const proxyUrl = `/api/avatars/${user.id}?t=${Date.now()}`;
      setDisplayAvatarUrl(proxyUrl);
    }
  }, [user?.avatarUrl, user?.id]);

  // Track user email changes for debugging
  useEffect(() => {
    console.log('[Profile] User email updated:', { email: user?.email, emailVerified: user?.emailVerified });
  }, [user?.email, user?.emailVerified]);



  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.auth.updateProfile.path, {
        method: api.auth.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, ...data }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui profil");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      login(updatedUser);
      queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
      toast({ title: t('common.success'), description: t('profile.success.profileUpdated') });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(api.auth.updateEmail.path, {
        method: api.auth.updateEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, email }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal memperbarui email");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowVerificationInput(true);
      setNewEmail("");
      toast({ 
        title: t('profile.changeEmailModal.sendVerificationCode'), 
        description: t('profile.changeEmailModal.checkYourEmail') 
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(api.auth.verifyEmail.path, {
        method: api.auth.verifyEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kode verifikasi tidak valid atau sudah kadaluarsa");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      console.log('[Profile] verifyEmailMutation onSuccess, updatedUser:', updatedUser);
      console.log('[Profile] updatedUser fields:', updatedUser ? Object.keys(updatedUser) : 'null');
      
      // Ensure updatedUser has required fields before login
      if (updatedUser?.id && updatedUser?.username) {
        console.log('[Profile] Calling login with valid user:', { id: updatedUser.id, username: updatedUser.username });
        login(updatedUser);
        setShowVerificationInput(false);
        setVerificationCode("");
        queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
        toast({ 
          title: t('common.success'), 
          description: t('profile.success.profileUpdated') 
        });
      } else {
        throw new Error(`Data user tidak lengkap dari server: id=${updatedUser?.id}, username=${updatedUser?.username}`);
      }
    },
    onError: (error: any) => {
      console.error('[Profile] verifyEmailMutation error:', error);
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onerror = () => {
        setIsUploadingAvatar(false);
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: t('profile.errors.failedToChange'),
        });
      };
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          
          // Show preview modal instead of uploading immediately
          setPreviewImageData(base64);
          setSelectedFile(file);
          setShowAvatarPreview(true);
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: t('common.error'),
            description: error.message || t('profile.errors.failedToChange'),
          });
        } finally {
          setIsUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setIsUploadingAvatar(false);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('profile.errors.failedToChange'),
      });
    }
  };

  const handleAvatarConfirm = async (croppedData: string) => {
    setShowAvatarPreview(false);
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(api.auth.uploadAvatar.path, {
        method: api.auth.uploadAvatar.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(user?.id),
          filename: selectedFile?.name || "avatar.png",
          data: croppedData,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal mengunggah foto");
      }

      const data = await res.json();
      // Store base URL without timestamp
      setBaseAvatarUrl(data.avatarUrl);
      // Display URL with cache-busting timestamp
      const urlWithTimestamp = `${data.avatarUrl}?t=${Date.now()}`;
      setDisplayAvatarUrl(urlWithTimestamp);
      
      // Clear preview data
      setPreviewImageData("");
      setSelectedFile(null);
      
      // Update user in auth context with cache-buster (triggers header update)
      if (user) {
        login({ ...user, avatarUrl: urlWithTimestamp });
      }
      
      toast({ title: t('common.success'), description: t('profile.success.photoUploaded') });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('profile.errors.failedToChange'),
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAvatar = async () => {
    setShowDeleteConfirm(false);
    setIsDeletingAvatar(true);
    try {
      const res = await fetch(api.auth.deleteAvatar.path, {
        method: api.auth.deleteAvatar.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(user?.id),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal menghapus foto");
      }

      // Clear avatar from state
      setBaseAvatarUrl("");
      setDisplayAvatarUrl("");
      
      // Update user in auth context (triggers re-login)
      if (user) {
        login({ ...user, avatarUrl: null });
      }
      
      toast({ title: t('common.success'), description: t('profile.success.photoDeleted') });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('profile.errors.failedToChange'),
      });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const autoSaveProfile = useCallback(
    (updates: any) => {
      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer with 1 second delay
      saveTimerRef.current = setTimeout(() => {
        if (Object.keys(updates).length > 0) {
          setIsSavingProfile(true);
          updateProfileMutation.mutate(updates, {
            onSettled: () => setIsSavingProfile(false),
          });
        }
      }, 1000);
    },
    [updateProfileMutation]
  );

  // Auto-save when username changes
  useEffect(() => {
    if (username !== user?.username && username.trim() !== "") {
      autoSaveProfile({ username });
    }
  }, [username, user?.username, autoSaveProfile]);

  // Auto-save when gender changes
  useEffect(() => {
    if (gender !== user?.gender) {
      autoSaveProfile({ gender });
    }
  }, [gender, user?.gender, autoSaveProfile]);

  // Handle PIN change
  const handleChangePinSubmit = async () => {
    // Validation
    if (!oldPinInput || oldPinInput.length !== 4) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.errors.oldPinMust') });
      return;
    }
    if (!newPinInput || newPinInput.length !== 4) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.errors.newPinMust') });
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.errors.pinMustMatch') });
      return;
    }
    if (oldPinInput === newPinInput) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.errors.pinMustDifferent') });
      return;
    }

    setIsChangingPin(true);
    try {
      const res = await fetch(api.auth.updateProfile.path, {
        method: api.auth.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user?.id, 
          pin: newPinInput,
          oldPin: oldPinInput 
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t('profile.errors.failedToChange'));
      }

      // Close modal and reset
      setShowChangePinModal(false);
      setOldPinInput("");
      setNewPinInput("");
      setConfirmNewPinInput("");
      setPin("");

      toast({ title: t('common.success'), description: t('profile.success.pinChanged') });
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setIsChangingPin(false);
    }
  };

  // Handle email change - Step 1: Send verification code
  const handleSendVerificationCode = async () => {
    setIsSendingVerificationCode(true);
    try {
      const res = await fetch(api.auth.sendRegistrationEmail.path, {
        method: api.auth.sendRegistrationEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal mengirim kode verifikasi");
      }

      // Move to step 1 (enter verification code)
      setEmailChangeStep(1);
      toast({ title: t('profile.changeEmailModal.sendVerificationCode'), description: t('profile.changeEmailModal.checkYourEmail') });
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setIsSendingVerificationCode(false);
    }
  };

  // Handle email change - Step 2: Verify identity
  const handleVerifyIdentity = async () => {
    if (!identityVerificationCode.trim()) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.changeEmailModal.enterCode') });
      return;
    }

    setIsVerifyingIdentity(true);
    try {
      const res = await fetch(api.auth.verifyEmail.path, {
        method: api.auth.verifyEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: identityVerificationCode }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kode verifikasi tidak valid");
      }

      // Move to step 2
      setEmailChangeStep(2);
      setIdentityVerificationCode("");
      toast({ title: t('common.success'), description: t('auth.verified') });
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setIsVerifyingIdentity(false);
    }
  };

  // Handle email change - Step 2: Submit new email and send verification code
  const handleSubmitNewEmail = async () => {
    if (!newEmailInput.trim() || !newEmailInput.includes("@")) {
      toast({ variant: "destructive", title: t('common.error'), description: t('auth.errors.enterEmail') });
      return;
    }

    if (newEmailInput === user?.email) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.changeEmailModal.newEmail') });
      return;
    }

    setIsSubmittingNewEmail(true);
    try {
      const res = await fetch(api.auth.sendRegistrationEmail.path, {
        method: api.auth.sendRegistrationEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmailInput, userId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal mengirim kode verifikasi");
      }

      // Move to step 3 (verify new email)
      setEmailChangeStep(3);
      setNewEmailVerificationCode("");
      toast({ title: t('profile.changeEmailModal.sendVerificationCode'), description: t('profile.changeEmailModal.checkYourEmail') });
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setIsSubmittingNewEmail(false);
    }
  };

  // Handle email change - Step 3: Verify new email
  const handleVerifyNewEmail = async () => {
    if (!newEmailVerificationCode.trim()) {
      toast({ variant: "destructive", title: t('common.error'), description: t('profile.changeEmailModal.enterCode') });
      return;
    }

    setIsVerifyingNewEmail(true);
    try {
      console.log('[Email Change] === VERIFY NEW EMAIL START ===');
      console.log('[Email Change] Current user:', user);
      
      // First verify the token - this endpoint returns the updated full user object from server
      console.log('[Email Change] Verifying token...');
      const verifyRes = await fetch(api.auth.verifyEmail.path, {
        method: api.auth.verifyEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newEmailVerificationCode }),
      });

      if (!verifyRes.ok) {
        const error = await verifyRes.json();
        throw new Error(error.message || "Kode verifikasi tidak valid");
      }
      
      // Get the verified user from response - this is the SOURCE OF TRUTH from server
      const verifiedUserData = await verifyRes.json();
      console.log('[Email Change] Token verified, user from server:', verifiedUserData);

      // Update user context with the data from server (not local guess)
      if (verifiedUserData) {
        console.log('[Email Change] Logging in with server user data:', verifiedUserData);
        login(verifiedUserData);
        console.log('[Email Change] After login() called with server data');
      } else {
        throw new Error("Tidak mendapat data user dari server setelah verifikasi");
      }

      // Close modal and reset
      setShowChangeEmailModal(false);
      setEmailChangeStep(0);
      setIdentityVerificationCode("");
      setNewEmailInput("");
      setNewEmailVerificationCode("");

      toast({ title: t('common.success'), description: t('profile.success.profileUpdated') });
      
      console.log('[Email Change] === VERIFY NEW EMAIL END ===');
    } catch (error: any) {
      console.error('[Email Change] Error:', error);
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setIsVerifyingNewEmail(false);
    }
  };

  // Reset email modal when closed
  const handleCloseEmailModal = () => {
    setShowChangeEmailModal(false);
    setEmailChangeStep(0);
    setIdentityVerificationCode("");
    setNewEmailInput("");
    setNewEmailVerificationCode("");
    setIsSubmittingNewEmail(false);
    setIsVerifyingNewEmail(false);
  };

  return !user ? (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-3xl font-black text-foreground">🎀 {t('profile.profile')}</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">{t('common.loading')}</p>
      </div>
    </div>
  ) : (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-3xl font-black text-foreground">🎀 {t('profile.profile')}</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          {t('profile.editProfile')}
        </p>
      </div>

      {/* Avatar Section */}
      <Card className="border-none shadow-2xl bg-gradient-to-br from-pink-50 to-pink-100/50 dark:bg-gradient-to-br dark:from-purple-900/80 dark:via-purple-800/80 dark:to-pink-900/80 backdrop-blur-md rounded-3xl overflow-hidden dark:border dark:border-pink-400/30">
        <CardHeader className="pb-4 pt-6">
          <div className="flex flex-col items-center gap-5">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title={t('profile.avatarTooltip')}
            >
              <Avatar className="w-28 h-28 border-4 border-white dark:border-pink-300/50 shadow-2xl hover:shadow-pink-500/30 transition-all duration-300 ring-4 ring-pink-200/50 dark:ring-pink-500/30">
                <AvatarImage src={displayAvatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-pink-600 text-white text-4xl font-bold">
                  {(user?.username && String(user.username).charAt(0).toUpperCase()) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                {isUploadingAvatar ? (
                  <Loader2 className="text-white w-8 h-8 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="text-white w-7 h-7" />
                    <span className="text-white text-xs font-bold">{t('common.edit').toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-pink-500 dark:bg-pink-400 rounded-full p-2 shadow-lg border-2 border-white dark:border-purple-900">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div className="text-center">
              <CardTitle className="text-2xl font-black text-foreground">{user?.username || t('common.loading')}</CardTitle>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-1">ID {t('auth.username')}: #{user?.id || "..."}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="username" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <UserIcon size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                {t('auth.username')}
              </Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm"
                placeholder={t('auth.enterUsername')}
              />
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Camera size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                {t('profile.avatar')}
              </Label>
              <div className="text-sm text-muted-foreground bg-pink-100/50 dark:bg-pink-500/10 rounded-xl p-4 border border-pink-200/50 dark:border-pink-400/30 font-medium">
                📸 {t('profile.uploadPhoto')}
              </div>
              {baseAvatarUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeletingAvatar}
                  className="w-full rounded-xl"
                >
                  {isDeletingAvatar ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('profile.deletePhoto')}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Lock size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                {t('profile.changePIN')}
              </Label>
              <Button
                type="button"
                onClick={() => setShowChangePinModal(true)}
                className="w-full rounded-2xl py-6 font-bold text-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white transition-all shadow-lg shadow-purple-500/20"
              >
                🔐 {t('profile.changePIN')}
              </Button>
              <p className="text-xs text-muted-foreground font-medium">{t('profile.manageSecurityPin')}</p>
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="gender" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <UserIcon size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                {t('auth.gender')}
              </Label>
              <Select value={gender} onValueChange={setGender} name="gender">
                <SelectTrigger id="gender" className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="male" className="font-medium">👦🏻 {t('auth.genderMale').replace('👦🏻 ', '')}</SelectItem>
                  <SelectItem value="female" className="font-medium">👧🏻 {t('auth.genderFemale').replace('👧🏻 ', '')}</SelectItem>
                  <SelectItem value="other" className="font-medium">🤷 {t('auth.genderOther').replace('🤷 ', '')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email Section */}
            <div className="space-y-3 pb-4 pt-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Mail size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                {t('auth.email')}
              </Label>
              <div className="bg-pink-100/50 dark:bg-pink-500/10 rounded-xl p-4 border border-pink-200/50 dark:border-pink-400/30">
                {user?.email && user?.emailVerified ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/20 p-2 rounded-lg">
                        <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">{user.email}</span>
                        <span className="text-xs text-muted-foreground">{t('auth.verified')}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowChangeEmailModal(true)}
                      className="w-full rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all py-2"
                    >
                      ✏️ {t('profile.changeEmail')}
                    </Button>
                  </div>
                ) : user?.email ? (
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-500/20 p-2 rounded-lg">
                      <RefreshCw className="text-yellow-600 dark:text-yellow-400" size={18} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-foreground block">{user.email}</span>
                      <span className="text-xs text-muted-foreground">{t('common.pending')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-medium">🔔 {t('profile.changeEmail')}</p>
                    <Button
                      type="button"
                      onClick={() => setShowChangeEmailModal(true)}
                      className="w-full rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all py-2"
                    >
                      ➕ {t('profile.changeEmail')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              {isSavingProfile && (
                <div className="flex items-center justify-center gap-2 text-sm text-pink-600 dark:text-pink-300 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('profile.changePinModal.saving')}
                </div>
              )}

              <Button
                type="button"
                onClick={toggleTheme}
                variant="outline"
                className="w-full rounded-2xl py-6 font-bold text-lg border-pink-200 dark:border-pink-400/30 hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-5 w-5" />
                    {t('profile.switchToLightMode')}
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-5 w-5" />
                    {t('profile.switchToDarkMode')}
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                variant="outline"
                className="w-full rounded-2xl py-6 font-bold text-lg border-pink-200 dark:border-pink-400/30 hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
              >
                🌐 {t('common.switchLanguage')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AvatarPreviewModal
        isOpen={showAvatarPreview}
        imageData={previewImageData}
        onConfirm={handleAvatarConfirm}
        onCancel={() => {
          setShowAvatarPreview(false);
          setPreviewImageData("");
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.deletePhoto')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.deletePhoto')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAvatar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAvatar ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change PIN Modal */}
      <AlertDialog open={showChangePinModal} onOpenChange={setShowChangePinModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">🔐 {t('profile.changePinModal.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.manageSecurityPin')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Old PIN */}
            <div className="space-y-2">
              <Label htmlFor="oldPin" className="font-bold text-foreground">{t('profile.changePinModal.oldPin')}</Label>
              <div className="relative">
                <Input
                  id="oldPin"
                  type={showOldPin ? "text" : "password"}
                  maxLength={4}
                  placeholder="• • • •"
                  value={oldPinInput}
                  onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 tracking-widest text-center text-lg font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPin(!showOldPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showOldPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New PIN */}
            <div className="space-y-2">
              <Label htmlFor="newPin" className="font-bold text-foreground">{t('profile.changePinModal.newPin')}</Label>
              <div className="relative">
                <Input
                  id="newPin"
                  type={showNewPin ? "text" : "password"}
                  maxLength={4}
                  placeholder="• • • •"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 tracking-widest text-center text-lg font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New PIN */}
            <div className="space-y-2">
              <Label htmlFor="confirmPin" className="font-bold text-foreground">{t('profile.changePinModal.confirmNewPin')}</Label>
              <div className="relative">
                <Input
                  id="confirmPin"
                  type={showConfirmNewPin ? "text" : "password"}
                  maxLength={4}
                  placeholder="• • • •"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 tracking-widest text-center text-lg font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPin(!showConfirmNewPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {newPinInput && confirmNewPinInput && newPinInput === confirmNewPinInput && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  ✓ {t('common.confirmed')}
                </p>
              )}
              {newPinInput && confirmNewPinInput && newPinInput !== confirmNewPinInput && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  ✗ {t('profile.errors.pinMustMatch')}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground font-medium bg-pink-50 dark:bg-pink-500/10 p-3 rounded-lg">
              💡 {t('profile.errors.oldPinMust')}
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <button
              onClick={handleChangePinSubmit}
              disabled={isChangingPin || !oldPinInput || !newPinInput || !confirmNewPinInput || oldPinInput.length !== 4 || newPinInput.length !== 4}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isChangingPin ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  {t('profile.changePinModal.saving')}
                </>
              ) : (
                t('profile.changePinModal.save')
              )}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Email Modal */}
      <AlertDialog open={showChangeEmailModal} onOpenChange={handleCloseEmailModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              {emailChangeStep === 0 ? "📧 " + t('profile.changeEmailModal.title') : emailChangeStep === 1 ? "📧 " + t('auth.verified') : emailChangeStep === 2 ? "📧 " + t('profile.changeEmailModal.newEmail') : "📧 " + t('profile.changeEmailModal.verification')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {emailChangeStep === 0 
                ? t('profile.changeEmailModal.title')
                : emailChangeStep === 1
                ? t('profile.changeEmailModal.enterCode')
                : emailChangeStep === 2
                ? t('profile.changeEmailModal.title')
                : t('profile.changeEmailModal.enterCode')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {emailChangeStep === 0 ? (
            // Step 0: Confirm Email Change
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-lg border border-blue-200/50 dark:border-blue-400/30">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-2">{t('auth.email')}</p>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{user?.email || t('common.noData')}</p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-200/50 dark:border-amber-400/30">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-300 mb-1">⚠️ {t('auth.verified')}</p>
                <p className="text-xs text-amber-900 dark:text-amber-200">{t('profile.changeEmailModal.verification')}</p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                <button
                  onClick={handleSendVerificationCode}
                  disabled={isSendingVerificationCode}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSendingVerificationCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      {t('common.sending')}
                    </>
                  ) : (
                    "📧 " + t('profile.changeEmailModal.sendVerificationCode')
                  )}
                </button>
              </div>
            </div>
          ) : emailChangeStep === 1 ? (
            // Step 1: Verify Identity
            <div className="space-y-4 py-4">
              <div className="bg-green-50 dark:bg-green-500/10 p-3 rounded-lg border border-green-200/50 dark:border-green-400/30">
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  ✓ {t('common.sending')}<br />
                  <span className="font-bold">{user?.email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identityCode" className="font-bold text-foreground">{t('profile.changeEmailModal.enterCode')}</Label>
                <Input
                  id="identityCode"
                  type="text"
                  placeholder={t('profile.changeEmailModal.enterCode')}
                  value={identityVerificationCode}
                  onChange={(e) => setIdentityVerificationCode(e.target.value)}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setEmailChangeStep(0)}
                  className="px-6 py-2 rounded-xl border border-pink-200/50 dark:border-pink-400/30 text-foreground font-bold hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
                >
                  ← {t('common.back')}
                </button>
                <button
                  onClick={handleVerifyIdentity}
                  disabled={isVerifyingIdentity || !identityVerificationCode.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isVerifyingIdentity ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      {t('common.verifying')}
                    </>
                  ) : (
                    "✓ " + t('auth.verified')
                  )}
                </button>
              </div>
            </div>
          ) : emailChangeStep === 2 ? (
            // Step 2: Enter New Email
            <div className="space-y-4 py-4">
              <div className="bg-green-50 dark:bg-green-500/10 p-3 rounded-lg border border-green-200/50 dark:border-green-400/30">
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  ✓ {t('auth.verified')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newEmail" className="font-bold text-foreground">{t('profile.changeEmailModal.newEmail')}</Label>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="email@example.com"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg">
                💡 {t('profile.changeEmailModal.verification')}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setEmailChangeStep(1)}
                  className="px-6 py-2 rounded-xl border border-pink-200/50 dark:border-pink-400/30 text-foreground font-bold hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
                >
                  ← {t('common.back')}
                </button>
                <button
                  onClick={handleSubmitNewEmail}
                  disabled={isSubmittingNewEmail || !newEmailInput.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmittingNewEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      {t('common.sending')}
                    </>
                  ) : (
                    "📧 " + t('profile.changeEmailModal.sendVerificationCode')
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Step 3: Verify New Email
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 dark:bg-purple-500/10 p-3 rounded-lg border border-purple-200/50 dark:border-purple-400/30">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                  ✓ {t('common.sending')}<br />
                  <span className="font-bold">{newEmailInput}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newEmailCode" className="font-bold text-foreground">{t('profile.changeEmailModal.enterCode')}</Label>
                <Input
                  id="newEmailCode"
                  type="text"
                  placeholder={t('profile.changeEmailModal.enterCode')}
                  value={newEmailVerificationCode}
                  onChange={(e) => setNewEmailVerificationCode(e.target.value)}
                  className="rounded-xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setEmailChangeStep(2)}
                  className="px-6 py-2 rounded-xl border border-pink-200/50 dark:border-pink-400/30 text-foreground font-bold hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
                >
                  ← {t('common.back')}
                </button>
                <button
                  onClick={handleVerifyNewEmail}
                  disabled={isVerifyingNewEmail || !newEmailVerificationCode.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isVerifyingNewEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      {t('common.verifying')}
                    </>
                  ) : (
                    "✓ " + t('profile.changeEmailModal.title')
                  )}
                </button>
              </div>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
