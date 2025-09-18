'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateUserRole, inviteUser, deactivateUser } from '@/lib/actions/auth/user-management';
import { User } from '@/lib/db/schema';
import { UserPlus, MoreHorizontal, Shield, Edit, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormStatus } from 'react-dom';

interface UserManagementProps {
  users: User[];
  currentUserId: string;
}

function SubmitButton({ children, ...props }: { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? 'Processing...' : children}
    </Button>
  );
}

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const handleInviteUser = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    
    const result = await inviteUser(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('User invited successfully');
      setIsInviteOpen(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('role', role);
    
    const result = await updateUserRole(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('User role updated successfully');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('userId', userId);
    
    const result = await deactivateUser(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('User deactivated successfully');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'editor':
        return 'default';
      case 'viewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage users and their roles in your workspace
          </p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation to a new user to join your workspace
              </DialogDescription>
            </DialogHeader>
            
            <form action={handleInviteUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue="viewer">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <SubmitButton className="w-full">
                Send Invitation
              </SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.lastLoginAt 
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : 'Never'
                  }
                </TableCell>
                <TableCell>
                  {user.id !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(user.id, 'admin')}
                          disabled={user.role === 'admin'}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(user.id, 'editor')}
                          disabled={user.role === 'editor'}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Make Editor
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(user.id, 'viewer')}
                          disabled={user.role === 'viewer'}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Make Viewer
                        </DropdownMenuItem>
                        {user.isActive && (
                          <DropdownMenuItem
                            onClick={() => handleDeactivateUser(user.id)}
                            className="text-destructive"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}