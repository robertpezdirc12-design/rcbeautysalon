export const authSl = {
  login: {
    welcomeBack: "Dobrodošli nazaj",
    signInSubtitle: "Prijavite se v svoj račun za nadaljevanje",
    email: "E-pošta",
    password: "Geslo",
    forgotPassword: "Pozabljeno geslo?",
    signIn: "Prijava",
    noAccount: "Nimate računa?",
    createAccount: "Ustvari račun",
    ownSalon: "Imate svoje podjetje?",
    backToHome: "← Nazaj na domačo stran",
    demoCredentials: "Demo podatki za prijavo",
    adminFullAccess: "Admin (polni dostop):",
    staffAccess: "Osebje (portal za osebje):",
    clientAccess: "Stranka (moj račun):",
    toast: {
      verifyRequired: "Potrebna je potrditev e-pošte",
      verifyDescription:
        "Preverite mapo »Prejeto« in potrdite svoj e-poštni naslov pred prijavo. Če sporočila niste prejeli, preverite mapo »Neželena pošta«.",
      loginFailed: "Prijava ni uspela",
      invalidCredentials:
        "Neveljaven e-poštni naslov ali geslo. Poskusite znova.",
      loginSuccess: "Prijava uspešna!",
      redirecting: "Preusmerjanje na nadzorno ploščo …",
      somethingWrong: "Prišlo je do napake. Poskusite znova.",
    },
  },
  register: {
    createAccountTitle: "Ustvarite račun",
    getStarted: "Vnesite svoje podatke za začetek",
    fullName: "Ime in priimek",
    email: "E-pošta",
    password: "Geslo",
    confirmPassword: "Potrdite geslo",
    createAccountBtn: "Ustvari račun",
    haveAccount: "Že imate račun?",
    signIn: "Prijava",
    backToHome: "← Nazaj na domačo stran",
    toast: {
      failed: "Registracija ni uspela",
      failedDescription: "Registracija ni uspela. Poskusite znova.",
      created: "Račun uspešno ustvarjen!",
      createdDescription:
        "Preverite svoj e-poštni nabiralnik in potrdite račun pred prijavo.",
    },
    fallbackTitle: "Skoraj končano",
    fallbackDescription:
      "E-poštni servis še ni nastavljen, zato vam povezavo za potrditev računa prikažemo tukaj.",
    fallbackCta: "Potrdite svoj e-poštni naslov:",
    fallbackLink: "Potrdi račun zdaj",
    fallbackToLogin: "Nazaj na prijavo",
  },
  forgot: {
    title: "Pozabljeno geslo?",
    description:
      "Vnesite svoj e-poštni naslov in poslali vam bomo povezavo za ponastavitev gesla.",
    email: "E-pošta",
    sendResetLink: "Pošlji povezavo za ponastavitev",
    backToLogin: "← Nazaj na prijavo",
    backToHome: "← Nazaj na domačo stran",
    toast: {
      error: "Napaka",
      checkEmail: "Preverite e-pošto",
      checkEmailDescription:
        "Če račun obstaja, boste prejeli povezavo za ponastavitev gesla.",
    },
    fallbackTitle: "Povezava za ponastavitev",
    fallbackDescription:
      "E-poštni servis še ni nastavljen, zato povezavo za ponastavitev gesla prikažemo tukaj.",
    fallbackCta: "Nadaljujte s ponastavitvijo:",
    fallbackLink: "Ponastavi geslo zdaj",
  },
  reset: {
    title: "Ponastavite geslo",
    description: "Spodaj vnesite svoje novo geslo.",
    newPassword: "Novo geslo",
    newPasswordPlaceholder: "Vnesite novo geslo",
    confirmPassword: "Potrdite geslo",
    confirmPlaceholder: "Potrdite novo geslo",
    resetBtn: "Ponastavi geslo",
    backToLogin: "← Nazaj na prijavo",
    toast: {
      error: "Napaka",
      success: "Geslo je uspešno ponastavljeno",
      successDescription: "Zdaj se lahko prijavite z novim geslom.",
    },
  },
  verifyEmail: {
    verifying: "Potrjujemo e-poštni naslov …",
    verifyingDescription: "Trenutek, prosimo …",
    successTitle: "E-pošta potrjena!",
    successDescription:
      "Vaš e-poštni naslov je uspešno potrjen. Zdaj se lahko prijavite.",
    errorTitle: "Potrditev ni uspela",
    errorDescription: "Povezava za potrditev je neveljavna ali je potekla.",
    signIn: "Prijava",
    backToHome: "← Nazaj na domačo stran",
  },
}

export type AuthDict = typeof authSl

export const authEn: AuthDict = {
  login: {
    welcomeBack: "Welcome back",
    signInSubtitle: "Sign in to your account to continue",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    signIn: "Sign In",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    ownSalon: "Own a business?",
    backToHome: "← Back to home",
    demoCredentials: "Demo Credentials:",
    adminFullAccess: "Admin (Full Access):",
    staffAccess: "Staff (Staff Portal):",
    clientAccess: "Client (My Account):",
    toast: {
      verifyRequired: "Email verification required",
      verifyDescription:
        "Please check your inbox and verify your email address before logging in. If you didn't receive the email, check your spam folder.",
      loginFailed: "Login failed",
      invalidCredentials: "Invalid email or password. Please try again.",
      loginSuccess: "Login successful!",
      redirecting: "Redirecting to dashboard...",
      somethingWrong: "Something went wrong. Please try again.",
    },
  },
  register: {
    createAccountTitle: "Create an account",
    getStarted: "Enter your information to get started",
    fullName: "Full Name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    createAccountBtn: "Create Account",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    backToHome: "← Back to home",
    toast: {
      failed: "Registration failed",
      failedDescription: "Registration failed. Please try again.",
      created: "Account created successfully!",
      createdDescription:
        "Please check your email to verify your account before logging in.",
    },
    fallbackTitle: "Almost done",
    fallbackDescription:
      "The email service is not yet configured, so we're showing your account verification link here.",
    fallbackCta: "Verify your email address:",
    fallbackLink: "Verify account now",
    fallbackToLogin: "Back to sign in",
  },
  forgot: {
    title: "Forgot your password?",
    description:
      "Enter your email address and we'll send you a link to reset your password.",
    email: "Email",
    sendResetLink: "Send reset link",
    backToLogin: "← Back to sign in",
    backToHome: "← Back to home",
    toast: {
      error: "Error",
      checkEmail: "Check your email",
      checkEmailDescription:
        "If an account exists, you'll receive a reset link.",
    },
    fallbackTitle: "Reset link",
    fallbackDescription:
      "The email service is not yet configured, so we're showing your password reset link here.",
    fallbackCta: "Continue with the reset:",
    fallbackLink: "Reset password now",
  },
  reset: {
    title: "Reset your password",
    description: "Enter your new password below.",
    newPassword: "New Password",
    newPasswordPlaceholder: "Enter your new password",
    confirmPassword: "Confirm Password",
    confirmPlaceholder: "Confirm your new password",
    resetBtn: "Reset Password",
    backToLogin: "← Back to sign in",
    toast: {
      error: "Error",
      success: "Password reset successful",
      successDescription: "You can now log in with your new password.",
    },
  },
  verifyEmail: {
    verifying: "Verifying your email …",
    verifyingDescription: "One moment, please …",
    successTitle: "Email verified!",
    successDescription:
      "Your email address has been verified. You can now sign in.",
    errorTitle: "Verification failed",
    errorDescription:
      "The verification link is invalid or has expired.",
    signIn: "Sign In",
    backToHome: "← Back to home",
  },
}
